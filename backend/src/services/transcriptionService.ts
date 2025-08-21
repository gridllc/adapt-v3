// backend/src/services/transcriptionService.ts
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { promisify } from 'util'
import { exec as _exec } from 'child_process'
import OpenAI from 'openai'
import { log } from '../utils/logger.js'
import { presignedUploadService } from './presignedUploadService.js'

const exec = promisify(_exec)

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------- Helpers ----------
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true })
}

async function downloadToFile(url: string, outPath: string) {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download: HTTP ${res.status}`)
  }
  await ensureDir(path.dirname(outPath))
  const file = fs.createWriteStream(outPath)
  
  // Convert ReadableStream to Node.js stream
  const nodeStream = require('stream').Readable.fromWeb(res.body)
  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(file)
    nodeStream.on('error', reject)
    file.on('finish', () => resolve())
    file.on('error', reject)
  })
  
  const { size } = await fs.promises.stat(outPath)
  if (size === 0) throw new Error('Downloaded file is empty')
}

async function extractAudio(inputPath: string, outputPath: string) {
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 "${outputPath}"`
  await exec(cmd)
  const { size } = await fs.promises.stat(outputPath)
  if (size === 0) throw new Error('FFmpeg produced empty audio file')
}

// ---------- OpenAI client (lazy) ----------
function makeOpenAI(): OpenAI {
  const key = requireEnv('OPENAI_API_KEY')
  return new OpenAI({ apiKey: key })
}

// ---------- Main ----------
/**
 * Transcribe a video either from a local uploads file OR an S3 key.
 * - If `uploads/<filename>` exists, uses it.
 * - Otherwise treats `filename` as S3 key and downloads via a signed URL.
 * Saves transcript to `backend/src/data/transcripts/<moduleId>.json`.
 */
export async function transcribeS3Video(moduleId: string, filename: string): Promise<string> {
  const tmpBase = path.join(tmpdir(), `adapt-${moduleId}`)
  const tmpVideo = path.join(tmpBase, 'source.mp4')
  const tmpAudio = path.join(tmpBase, 'audio.mp3')
  const localUploadsPath = path.join(process.cwd(), 'uploads', filename)
  const transcriptPath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)

  let usedLocal = false

  try {
    log.info(`🎤 [${moduleId}] Transcription start`)
    await ensureDir(tmpBase)

    // 1) Acquire source video
    if (fs.existsSync(localUploadsPath)) {
      usedLocal = true
      log.info(`📁 [${moduleId}] Using local uploads file: ${localUploadsPath}`)
      await fs.promises.copyFile(localUploadsPath, tmpVideo)
    } else {
      log.info(`☁️ [${moduleId}] Local file not found. Treating "${filename}" as S3 key`)
      const signedUrl = await presignedUploadService.getSignedPlaybackUrl(filename)
      log.info(`🔗 [${moduleId}] Downloading from signed URL`)
      await downloadToFile(signedUrl, tmpVideo)
    }

    // 2) Extract audio (mp3, 16kHz mono)
    log.info(`🎵 [${moduleId}] Extracting audio with ffmpeg`)
    await extractAudio(tmpVideo, tmpAudio)
    log.info(`✅ [${moduleId}] Audio extracted`)

    // 3) Transcribe with OpenAI Whisper
    log.info(`🤖 [${moduleId}] Transcribing with OpenAI Whisper`)
    const openai = makeOpenAI()
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpAudio),
      model: 'whisper-1',
      response_format: 'json',
    })

    const text = (transcription as any)?.text as string | undefined
    if (!text || !text.trim()) {
      throw new Error('OpenAI returned empty transcript')
    }

    // 4) Persist transcript JSON
    await ensureDir(path.dirname(transcriptPath))
    const payload = {
      text,
      language: 'en',
      moduleId,
      createdAt: new Date().toISOString(),
      source: usedLocal ? 'local' : 's3',
    }
    await fs.promises.writeFile(transcriptPath, JSON.stringify(payload, null, 2))
    log.info(`💾 [${moduleId}] Transcript saved`, { path: transcriptPath })

    return text
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    log.error(`❌ [${moduleId}] Transcription failed: ${msg}`)

    // Fallback transcript so caller logic can still proceed
    const fallback = 'Transcription failed. Please verify ffmpeg availability and OpenAI API key.'
    try {
      await ensureDir(path.dirname(transcriptPath))
      const payload = {
        text: fallback,
        language: 'en',
        moduleId,
        createdAt: new Date().toISOString(),
        error: msg,
      }
      await fs.promises.writeFile(transcriptPath, JSON.stringify(payload, null, 2))
      log.warn(`⚠️ [${moduleId}] Wrote fallback transcript`, { path: transcriptPath })
    } catch (persistErr: any) {
      log.error(`⚠️ [${moduleId}] Failed to persist fallback transcript: ${persistErr?.message ?? persistErr}`)
    }

    return fallback
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tmpAudio)) await fs.promises.unlink(tmpAudio)
      if (fs.existsSync(tmpVideo)) await fs.promises.unlink(tmpVideo)
      if (fs.existsSync(tmpBase)) await fs.promises.rmdir(tmpBase).catch(async () => {
        // rmdir can fail if not empty; try recursive
        await fs.promises.rm(tmpBase, { recursive: true, force: true })
      })
      log.info(`🧹 [${moduleId}] Temp cleanup complete`)
    } catch (cleanupErr: any) {
      log.warn(`⚠️ [${moduleId}] Temp cleanup warning: ${cleanupErr?.message ?? cleanupErr}`)
    }
  }
}
