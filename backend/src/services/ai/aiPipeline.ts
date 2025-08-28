import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { stepSaver } from './stepSaver.js'
import { generateVideoSteps } from './stepGenerator.js'
import { prisma } from '../../config/database.js'
import { log as logger } from '../../utils/logger.js'
import { promises as fs } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { normalizeSteps, RawStep } from './stepProcessor.js'

// Lazy S3 client initialization to avoid process.env issues during module load
let s3Client: S3Client | null = null
let bucketName: string | null = null

function getS3Client() {
  if (!s3Client) {
    const region = process.env.AWS_REGION
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('AWS S3 credentials not available')
    }

    s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey }
    })
  }
  return s3Client
}

function getBucketName() {
  if (!bucketName) {
    bucketName = process.env.AWS_BUCKET_NAME
    if (!bucketName) {
      throw new Error('AWS_BUCKET_NAME not available')
    }
  }
  return bucketName
}

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

// CRITICAL: Duration-aware pipeline - never defaults to 60s
export async function runPipeline(moduleId: string, s3Key: string) {
  console.info('[AIPipeline] start', { moduleId, s3Key })

  // lock module
  await prisma.module.update({ where: { id: moduleId }, data: { status: 'PROCESSING' } })

  try {
    // 1) Transcribe (get segments + real duration from transcriber)
    const { segments, durationSec: fromTranscriber } = await transcribeToSegments(s3Key)

    // 2) Make sure Module.durationSec is the REAL value (no 60s default)
    const ensured = await ModuleService.ensureDurationSec(moduleId, s3Key)
    const durationSec = Math.round(ensured || fromTranscriber || 0)
    if (!durationSec || durationSec <= 0) {
      throw new Error('No valid durationSec available')
    }
    await ModuleService.setDurationSec(moduleId, durationSec)

    // 3) AI steps (titles/descriptions) – now with real duration + segments
    const transcriptText = segments.map(s => s.text).join(' ')
    const aiSteps = await aiGenerateSteps(transcriptText, segments, durationSec, moduleId)

    // 4) Build raw steps and normalize/clamp to real duration
    const raw: RawStep[] = mapAiStepsToSegments(aiSteps, segments)
    const finalSteps = normalizeSteps(raw, durationSec)

    // 5) Persist JSON to S3 (single source of truth). Always write {steps,start/end,meta.durationSec}
    const payload = {
      steps: finalSteps,
      meta: { durationSec, source: 'pipeline' },
      transcript: transcriptText,
    }

    await getS3Client().send(new PutObjectCommand({
      Bucket: getBucketName(),
      Key: `training/${moduleId}.json`,
      ContentType: 'application/json',
      ACL: 'private',
      Body: JSON.stringify(payload),
    }))
    console.info('[AIPipeline] wrote training JSON', { moduleId, steps: finalSteps.length, durationSec })

    // 6) (Optional) hydrate DB mirror
    await prisma.step.deleteMany({ where: { moduleId } }).catch(() => {})
    if (finalSteps.length) {
      await prisma.$transaction(
        finalSteps.map((s, i) =>
          prisma.step.create({
            data: {
              moduleId,
              order: i,
              startTime: Number(s.start) || 0,
              endTime: Number(s.end) || 0,
              text: s.title,
            },
          })
        )
      )
    }

    await prisma.module.update({ where: { id: moduleId }, data: { status: 'READY' } })
    console.info('[AIPipeline] complete', { moduleId })
  } catch (err: any) {
    console.error('[AIPipeline] FAILED', { moduleId, message: err?.message })
    await prisma.module.update({
      where: { id: moduleId },
      data: { status: 'FAILED', lastError: err?.message?.slice(0, 240) }
    })
    throw err
  }
}

// ---- Plug your implementations here ----
async function transcribeToSegments(s3Key: string): Promise<{ segments: { start: number; end: number; text: string }[]; durationSec: number }> {
  // Extract audio and transcribe to get segments + real video duration (no guessing!)

  console.log(`[Transcription] Getting real duration and segments for ${s3Key}`)

  // Download video to temp file
  const signedUrl = await storageService.generateSignedUrl(s3Key, 3600)
  const response = await fetch(signedUrl)
  const buffer = await response.arrayBuffer()
  const localMp4 = `/tmp/${Date.now()}.mp4`
  await fs.writeFile(localMp4, Buffer.from(buffer))

  try {
    // CRITICAL: Get REAL video duration from file metadata (not from segments!)
    const realDurationSec = await audioProcessor.getVideoDuration(localMp4)
    console.log(`[Transcription] Real video duration: ${realDurationSec}s`)

    // Extract audio for transcription
    const wavPath = await audioProcessor.extract(localMp4)
    await fs.unlink(localMp4).catch(() => {})

    // Transcribe the audio
    const transcript = await transcribeAudio(wavPath, 'temp')
    const segments = transcript.segments || []

    console.log(`[Transcription] Got ${segments.length} segments, real duration: ${realDurationSec}s`)

    return {
      segments,
      durationSec: realDurationSec // Always use real video duration, never guess from segments
    }
  } catch (error) {
    await fs.unlink(localMp4).catch(() => {})
    console.error('[Transcription] Failed to get real duration:', error)
    throw new Error(`Failed to get video duration: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function aiGenerateSteps(
  transcript: string,
  segments: Array<{ start: number; end: number; text: string }>,
  durationSec: number,
  moduleId: string
): Promise<Array<{ title: string; description?: string; start?: number; end?: number }>> {
  // Give AI the real duration + segments + moduleId to prevent guessing
  const result = await generateVideoSteps(transcript, segments, { duration: durationSec }, moduleId)
  return (result.steps || []).map(step => ({
    title: step.title || step.text || '',
    description: step.notes || '',
    start: Number(step.startTime ?? 0),
    end: Number(step.endTime ?? 0),
  }))
}
// ----------------------------------------

function mapAiStepsToSegments(ai: Array<{title:string;description?:string;start?:number;end?:number}>, segs: { start: number; end: number; text: string }[]): RawStep[] {
  // If AI provided timings, keep them; otherwise align by index to transcript segments.
  const out: RawStep[] = ai.map((s, i) => ({
    title: s.title,
    description: s.description ?? '',
    start: s.start ?? segs[i]?.start,
    end:   s.end   ?? segs[i]?.end,
  }))
  return out
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
    const actualBucketName = getBucketName()

    await prisma.module.upsert({
      where: { id: moduleId },
      update: {},
      create: {
        id: moduleId,
        s3Key,
        title: moduleTitle,
        filename: moduleTitle + '.mp4',
        videoUrl: `https://${actualBucketName}.s3.amazonaws.com/${s3Key}`,
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
