import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { stepSaver } from './stepSaver.js'
import { generateVideoSteps } from './stepGenerator.js'

/**
 * Unified entry point (matches qstashQueue import).
 */
export async function startProcessing(moduleId: string, opts?: { force?: boolean }) {
  return generateStepsFromVideo(moduleId, opts)
}

export async function generateStepsFromVideo(moduleId: string, opts?: { force?: boolean }) {
  const mod = await ModuleService.getModuleById(moduleId)
  if (!mod.success || !mod.module) throw new Error(`Module ${moduleId} not found`)

  // Ensure keys exist
  if (!mod.module.s3Key || !mod.module.stepsKey) {
    throw new Error(`Module ${moduleId} missing s3Key/stepsKey`)
  }

  // If already ready and not forcing, bail
  if (!opts?.force && mod.module.status === "READY") return { ok: true, skipped: true }

  // Try to acquire processing lock (atomic status flip)
  console.log(`🔒 [AIPipeline] Attempting to acquire processing lock for module: ${moduleId}`)
  const gotLock = await ModuleService.tryLockForProcessing(moduleId)
  if (!gotLock) {
    console.log(`🔒 [AIPipeline] Processing lock not acquired for module: ${moduleId} - another worker is processing`)
    return { ok: true, skipped: true, reason: 'Already being processed' }
  }

  console.log(`🔒 [AIPipeline] Processing lock acquired for module: ${moduleId} - starting work`)

  try {
    // 1) Download MP4 from S3 to temp
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 20, "Downloading video...")
    const { videoDownloader } = await import('./videoDownloader.js')
    const localMp4 = await videoDownloader.fromS3(mod.module.s3Key)

    // 2) Extract WAV with ffmpeg
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 35, "Converting video to audio...")
    const wavPath = await audioProcessor.extract(localMp4)

    // 3) Transcribe via OpenAI API
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 55, "Transcribing audio...")
    const transcript = await transcribeAudio(wavPath, moduleId)

    // 4) Turn transcript into steps
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 75, "Generating steps...")
    const steps = await generateVideoSteps(
      transcript.text,
      transcript.segments,
      { duration: 0 }, // Mock duration since we don't have video metadata
      moduleId
    )

    // 5) Save steps JSON to S3 + mark READY
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 85, "Saving steps...")
    await stepSaver.saveToS3(mod.module.stepsKey, {
      moduleId,
      title: mod.module.title ?? 'Training',
      transcript: transcript.text,
      segments: transcript.segments,
      steps: steps.steps,
    })

    await ModuleService.markReady(moduleId)
    console.log(`✅ [AIPipeline] Module ${moduleId} processing complete`)
    return { ok: true, moduleId }
  } catch (err: any) {
    console.error(`❌ [AIPipeline] Module ${moduleId} processing failed:`, err)
    await ModuleService.markFailed(moduleId, String(err?.message ?? err))
    throw err
  }
}
