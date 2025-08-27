import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { stepSaver } from './stepSaver.js'
import { generateVideoSteps } from './stepGenerator.js'
import { prisma } from '../../config/database.js'
import { log as logger } from '../../utils/logger.js'
import { env } from '../../config/env.js'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Pipeline phases for tracking
type Phase =
  | 'VERIFY_S3'
  | 'EXTRACT_AUDIO'
  | 'TRANSCRIBE'
  | 'GENERATE_STEPS'
  | 'WRITE_JSON'
  | 'HYDRATE_DB'

// Set module status with progress and message
async function setStatus(moduleId: string, status: 'PROCESSING'|'READY'|'FAILED', progress: number, message?: string) {
  await prisma.module.update({
    where: { id: moduleId },
    data: { status, progress, errorMessage: message ?? null },
  })
  console.info('[AIPipeline] status', { moduleId, status, progress, message })
}

// Execute a phase with progress tracking and timeout
async function step(moduleId: string, phase: Phase, pct: number, fn: () => Promise<any>) {
  console.info('[AIPipeline] phase start', { moduleId, phase })
  await setStatus(moduleId, 'PROCESSING', pct, phase)
  const out = await fn()
  console.info('[AIPipeline] phase done', { moduleId, phase })
  return out
}

// Main robust pipeline with Redis locking
export async function runPipeline(moduleId: string, s3Key: string) {
  const lockKey = `lock:pipeline:${moduleId}`
  const lock = crypto.randomUUID()

  // 0) Acquire 15-min lock to prevent duplicate runs
  const ok = await redis.set(lockKey, lock, { nx: true, ex: 15 * 60 })
  if (!ok) {
    const ttl = await redis.ttl(lockKey)
    console.warn('[AIPipeline] duplicate run blocked', { moduleId, ttl })
    await setStatus(moduleId, 'PROCESSING', 1, 'ALREADY_RUNNING')
    return
  }

  try {
    await setStatus(moduleId, 'PROCESSING', 1, 'START')

    // 1) Verify S3 object exists
    await step(moduleId, 'VERIFY_S3', 5, async () => {
      const { storageService } = await import('../storageService.js')
      const exists = await storageService.checkFileExists(s3Key)
      if (!exists) throw new Error('S3 object not found')
    })

    // 2) Extract audio (use ffmpeg-static; write to /tmp)
    const audioPath = await step(moduleId, 'EXTRACT_AUDIO', 15, async () => {
      const localMp4 = await storageService.downloadFromS3(s3Key, '/tmp')
      const wavPath = await audioProcessor.extract(localMp4)
      // Clean up temp MP4 file
      const fs = await import('fs')
      fs.unlinkSync(localMp4)
      return wavPath
    })

    // 3) Transcribe
    const transcript = await step(moduleId, 'TRANSCRIBE', 45, async () => {
      return await transcribeAudio(audioPath, moduleId)
    })

    // 4) Generate steps
    const steps = await step(moduleId, 'GENERATE_STEPS', 70, async () => {
      const videoDuration = await storageService.getVideoDuration(s3Key)
      return await generateVideoSteps(
        transcript.text,
        transcript.segments,
        { duration: videoDuration },
        moduleId
      )
    })

    // 5) Write canonical JSON to S3
    await step(moduleId, 'WRITE_JSON', 85, async () => {
      const stepsKey = `training/${moduleId}.json`
      await stepSaver.saveStepsToS3({
        moduleId,
        s3Key: stepsKey,
        steps: steps.steps,
        transcript: transcript.text,
        meta: {
          durationSec: steps.meta?.durationSec || 0,
          stepCount: steps.steps.length,
          segments: transcript.segments,
          source: 'ai'
        }
      })
    })

    // 6) Hydrate DB (optional)
    await step(moduleId, 'HYDRATE_DB', 95, async () => {
      // This happens in stepSaver, but we can add explicit tracking here
      return true
    })

    await setStatus(moduleId, 'READY', 100, 'DONE')
    console.info('[AIPipeline] COMPLETE', { moduleId })
  } catch (err: any) {
    const m = `${err?.name || 'Error'}: ${err?.message || 'unknown'}`
    console.error('[AIPipeline] FAILED', { moduleId, message: m, stack: err?.stack })
    await setStatus(moduleId, 'FAILED', 0, m.slice(0, 240))
    throw err
  } finally {
    // Always release lock
    await redis.del(lockKey).catch(() => {})
  }
}

/**
 * Context-aware process function for uploadController
 */
export async function process(ctx: { moduleId: string; s3Key: string; title?: string; rid?: string }) {
  const { moduleId, s3Key, title } = ctx
  const rid: string = ctx.rid ?? 'no-rid'
  logger.info('[AIPipeline] start', { moduleId: moduleId, rid: rid })

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

  // Use the robust pipeline wrapper
  return runPipeline(moduleId, s3Key).catch(e => {
    console.error('[AIPipeline] spawn error', e?.message)
    throw e
  })
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
    console.info('[AIPipeline] S3 HeadObject start', { moduleId: moduleId, rid: rid, s3Key: mod.module.s3Key })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 20, "Downloading video...")
    const { videoDownloader } = await import('./videoDownloader.js')
    const localMp4 = await videoDownloader.fromS3(mod.module.s3Key)
    console.info('[AIPipeline] S3 download complete', { moduleId: moduleId, rid: rid, localPath: localMp4 })

    // 2) Extract WAV with ffmpeg
    console.info('[AIPipeline] Audio extraction start', { moduleId: moduleId, rid: rid, videoPath: localMp4 })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 35, "Converting video to audio...")
    const wavPath = await audioProcessor.extract(localMp4)
    console.info('[AIPipeline] Audio extraction complete', { moduleId: moduleId, rid: rid, wavPath: wavPath })

    // 3) Transcribe via OpenAI API
    console.info('[AIPipeline] Transcription start', { moduleId: moduleId, rid: rid, wavPath: wavPath })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 55, "Transcribing audio...")
    const transcript = await transcribeAudio(wavPath, moduleId)
    console.info('[AIPipeline] Transcription complete', { moduleId: moduleId, rid: rid, chars: transcript.text.length })

    // 4) Get video duration for proper step timing
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 70, "Getting video duration...")
    const durationSec = await videoDownloader.getVideoDurationSeconds(localMp4)
    console.log(`📹 [AIPipeline] Video duration: ${durationSec}s`)

    // 5) Turn transcript into steps with actual video duration
    console.info('[AIPipeline] Step generation start', { moduleId: moduleId, rid: rid, transcriptChars: transcript.text.length })
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 75, "Generating steps...")
    const steps = await generateVideoSteps(
      transcript.text,
      transcript.segments,
      { duration: durationSec }, // Pass actual video duration
      moduleId
    )
    console.info('[AIPipeline] Step generation complete', { moduleId: moduleId, rid: rid, stepCount: steps.steps.length })

    // 6) Save steps JSON to S3 + mark READY
    console.info('[AIPipeline] S3 save start', { moduleId: moduleId, rid: rid, s3Key: mod.module.stepsKey })
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
    console.info('[AIPipeline] DB upserts start', { moduleId: moduleId, rid: rid })
    await ModuleService.markReady(moduleId)
    console.info('[AIPipeline] DB upserts complete', { moduleId: moduleId, rid: rid })
    console.log(`✅ [AIPipeline] Module ${moduleId} processing complete`)
    return { ok: true, moduleId }
  } catch (err: any) {
    console.error(`❌ [AIPipeline] Module ${moduleId} processing failed:`, err)
    await ModuleService.markFailed(moduleId, String(err?.message ?? err))
    throw err
  }
}
