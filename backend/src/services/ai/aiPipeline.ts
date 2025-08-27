import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { stepSaver } from './stepSaver.js'
import { generateVideoSteps } from './stepGenerator.js'
import { prisma } from '../../config/database.js'
import { log as logger } from '../../utils/logger.js'
import { env } from '../../config/env.js'

/**
 * Context-aware process function for uploadController
 */
export async function process(ctx: { moduleId: string; s3Key: string; title?: string; rid?: string }) {
  const { moduleId, s3Key, title } = ctx
  const rid = ctx.rid || 'no-rid'
  logger.info('[AIPipeline] start', { moduleId, rid })

  const mod = await prisma.module.findUnique({ where: { id: moduleId } })
  if (!mod) {
    const moduleTitle = title || 'Untitled'
    const bucketName = env.AWS_BUCKET_NAME

    await prisma.module.upsert({
      where: { id: moduleId },
      update: {},
      create: {
        id: moduleId,
        s3Key,
        title: moduleTitle,
        filename: moduleTitle + '.mp4',
        videoUrl: `https://${bucketName}.s3.amazonaws.com/${s3Key}`,
        status: 'PROCESSING',
        progress: 0
      },
    })
  }

  return generateStepsFromVideo(moduleId, s3Key)
}

/**
 * Unified entry point (matches qstashQueue import).
 */
export async function startProcessing(moduleId: string, opts?: { force?: boolean }) {
  return generateStepsFromVideo(moduleId, undefined, opts)
}

export async function generateStepsFromVideo(moduleId: string, s3Key?: string, opts?: { force?: boolean }) {
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
    console.info('[AIPipeline] S3 HeadObject start', { moduleId, rid, s3Key: mod.module.s3Key })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 20, "Downloading video...")
    const { videoDownloader } = await import('./videoDownloader.js')
    const localMp4 = await videoDownloader.fromS3(mod.module.s3Key)
    console.info('[AIPipeline] S3 download complete', { moduleId, rid, localPath: localMp4 })

    // 2) Extract WAV with ffmpeg
    console.info('[AIPipeline] Audio extraction start', { moduleId, rid, videoPath: localMp4 })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 35, "Converting video to audio...")
    const wavPath = await audioProcessor.extract(localMp4)
    console.info('[AIPipeline] Audio extraction complete', { moduleId, rid, wavPath })

    // 3) Transcribe via OpenAI API
    console.info('[AIPipeline] Transcription start', { moduleId, rid, wavPath })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 55, "Transcribing audio...")
    const transcript = await transcribeAudio(wavPath, moduleId)
    console.info('[AIPipeline] Transcription complete', { moduleId, rid, chars: transcript.text.length })

    // 4) Get video duration for proper step timing
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 70, "Getting video duration...")
    const durationSec = await videoDownloader.getVideoDurationSeconds(localMp4)
    console.log(`📹 [AIPipeline] Video duration: ${durationSec}s`)

    // 5) Turn transcript into steps with actual video duration
    console.info('[AIPipeline] Step generation start', { moduleId, rid, transcriptChars: transcript.text.length })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 75, "Generating steps...")
    const steps = await generateVideoSteps(
      transcript.text,
      transcript.segments,
      { duration: durationSec }, // Pass actual video duration
      moduleId
    )
    console.info('[AIPipeline] Step generation complete', { moduleId, rid, stepCount: steps.steps.length })

    // 6) Save steps JSON to S3 + mark READY
    console.info('[AIPipeline] S3 save start', { moduleId, rid, s3Key: mod.module.stepsKey })
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

    // DB upserts happen in stepSaver and markReady
    console.info('[AIPipeline] DB upserts start', { moduleId, rid })
    await ModuleService.markReady(moduleId)
    console.info('[AIPipeline] DB upserts complete', { moduleId, rid })
    console.log(`✅ [AIPipeline] Module ${moduleId} processing complete`)
    return { ok: true, moduleId }
  } catch (err: any) {
    console.error(`❌ [AIPipeline] Module ${moduleId} processing failed:`, err)
    await ModuleService.markFailed(moduleId, String(err?.message ?? err))
    throw err
  }
}
