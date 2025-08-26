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
  // Add timeout wrapper to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Processing timeout after 2 minutes')), 2 * 60 * 1000)
  })

  try {
    const result = await Promise.race([
      generateStepsFromVideoInternal(moduleId, opts),
      timeoutPromise
    ])
    return result
  } catch (error) {
    console.error(`❌ [AIPipeline] Module ${moduleId} processing failed with timeout/error:`, error)
    await ModuleService.markFailed(moduleId, String(error instanceof Error ? error.message : error))
    throw error
  }
}

async function generateStepsFromVideoInternal(moduleId: string, opts?: { force?: boolean }) {
  const mod = await ModuleService.getModuleById(moduleId)
  if (!mod.success || !mod.module) throw new Error(`Module ${moduleId} not found`)

  // Ensure keys exist
  if (!mod.module.s3Key || !mod.module.stepsKey) {
    throw new Error(`Module ${moduleId} missing s3Key/stepsKey`)
  }

  // 🔥 SAFETY CHECK - ensure we have a valid S3 key
  if (!mod.module.s3Key.includes('/')) {
    throw new Error(`Invalid S3 key: "${mod.module.s3Key}"`)
  }

  // If already ready and not forcing, bail
  if (!opts?.force && mod.module.status === "READY") return { ok: true, skipped: true }

  // If already processing and not forcing, skip (don't throw)
  if (!opts?.force && mod.module.status === "PROCESSING") {
    console.log(`⏳ [AIPipeline] Module ${moduleId} already PROCESSING; skipping duplicate trigger.`)
    return { ok: true, skipped: true, reason: 'Already processing' }
  }

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

    // 4) Get video duration for proper step timing
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 70, "Getting video duration...")
    const durationSec = await videoDownloader.getVideoDurationSeconds(localMp4)
    console.log(`📹 [AIPipeline] Video duration: ${durationSec}s`)

    // 5) Turn transcript into steps with actual video duration
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 75, "Generating steps...")
    const steps = await generateVideoSteps(
      transcript.text,
      transcript.segments,
      { duration: durationSec }, // Pass actual video duration
      moduleId
    )

    // 6) Save steps JSON to S3 + mark READY
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 85, "Saving steps...")
    
    await stepSaver.saveStepsToS3({
      moduleId: moduleId,
      s3Key: mod.module.stepsKey,
      steps: steps.steps,
      transcript: transcript.text,
      meta: {
        durationSec,
        stepCount: steps.steps.length,
        segments: transcript.segments
      }
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
