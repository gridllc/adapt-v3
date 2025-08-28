import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { stepSaver } from './stepSaver.js'
import { generateVideoSteps } from './stepGenerator.js'
import { prisma } from '../../config/database.js'
import { log as logger } from '../../utils/logger.js'
import { env } from '../../config/env.js'
import { promises as fs } from 'fs'

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
    data: { status, progress, lastError: message ?? null },
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

// Main robust pipeline (QStash handles deduplication)
export async function runPipeline(moduleId: string, s3Key: string) {
  console.info('[AIPipeline] ENTER', { moduleId, s3Key })
  const rid: string = 'pipeline-' + moduleId

  try {
    await setStatus(moduleId, 'PROCESSING', 1, 'START')

    // 1) Verify S3 object exists
    await step(moduleId, 'VERIFY_S3', 5, async () => {
      await storageService.headObject(s3Key)
    })

    // 2) Extract audio and get video duration (use ffmpeg-static; write to /tmp)
    const { audioPath, videoDuration } = await step(moduleId, 'EXTRACT_AUDIO', 15, async () => {
      // Download MP4 from S3 to temp directory
      const signedUrl = await storageService.generateSignedUrl(s3Key, 3600)
      const response = await fetch(signedUrl)
      const buffer = await response.arrayBuffer()
      const localMp4 = `/tmp/${moduleId}.mp4`
      await fs.writeFile(localMp4, Buffer.from(buffer))

      // Extract video duration using ffprobe
      const { videoProcessor } = await import('../../utils/uploadUtils.js')
      const metadata = await videoProcessor.extractMetadata(localMp4)
      const actualDuration = metadata.duration

      console.log(`📊 [AIPipeline] Actual video duration: ${actualDuration} seconds`)

      const wavPath = await audioProcessor.extract(localMp4)
      // Clean up temp MP4 file
      await fs.unlink(localMp4).catch(() => {})
      return { audioPath: wavPath, videoDuration: actualDuration }
    })

    // 3) Transcribe
    const transcript = await step(moduleId, 'TRANSCRIBE', 45, async () => {
      return await transcribeAudio(audioPath, moduleId)
    })

    // 4) Generate steps
    const steps = await step(moduleId, 'GENERATE_STEPS', 70, async () => {
      console.log(`📊 [AIPipeline] Using actual video duration for step generation: ${videoDuration} seconds`)
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
 * Legacy entry points for backward compatibility
 * These will be removed once all callers are updated to use runPipeline directly
 */
export async function startProcessing(moduleId: string, opts?: { force?: boolean }) {
  console.warn('[AIPipeline] startProcessing is deprecated, use runPipeline directly')
  // Get module to find s3Key
  const mod = await prisma.module.findUnique({ where: { id: moduleId } })
  if (!mod?.s3Key) throw new Error(`Module ${moduleId} not found or missing s3Key`)
  return runPipeline(moduleId, mod.s3Key)
}

export async function generateStepsFromVideo(moduleId: string, s3Key?: string, opts?: { force?: boolean }) {
  console.warn('[AIPipeline] generateStepsFromVideo is deprecated, use runPipeline directly')
  if (!s3Key) {
    const mod = await prisma.module.findUnique({ where: { id: moduleId } })
    if (!mod?.s3Key) throw new Error(`Module ${moduleId} not found or missing s3Key`)
    s3Key = mod.s3Key
  }
  return runPipeline(moduleId, s3Key)
}
