import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { prisma } from '../../config/database.js'
import { s3DownloadToTemp, inferS3KeyForModule } from './videoDownloader.js'

const TEMP_DIR = process.env.TEMP_DIR || '/app/temp'

// Loud log to confirm this file is being used
console.log('[AudioProcessor] Using S3-based extractor:', __filename)

function runFFmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => (err += d.toString()))
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err}`))))
  })
}

export async function extractAudioWavForModule(moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, s3Key: true, videoUrl: true }
  })
  if (!mod) throw new Error(`Module not found: ${moduleId}`)

  const key = inferS3KeyForModule(mod)
  if (!key) throw new Error(`No S3 key resolvable for module ${moduleId}`)

  const mp4Path = await s3DownloadToTemp(key, `${moduleId}.mp4`)
  const wavPath = path.join(TEMP_DIR, `${moduleId}.wav`)

  // 16 kHz mono PCM — friendliest for STT
  await runFFmpeg(['-i', mp4Path, '-vn', '-ac', '1', '-ar', '16000', wavPath])

  return { wavPath, tmpPaths: [mp4Path, wavPath] }
}

export async function cleanupTemp(paths: string[]) {
  await Promise.all(paths.map(async (p) => { try { await fs.unlink(p) } catch {} }))
}
