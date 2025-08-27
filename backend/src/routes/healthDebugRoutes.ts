import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { spawnSync } from 'node:child_process'

const router = Router()
const prisma = new PrismaClient({ log: ['error', 'warn', 'info'] })
const s3 = new S3Client({ region: process.env.AWS_REGION })

const tmo = <T>(p: Promise<T>, ms = 4000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms))])

router.get('/health/full', async (_req, res) => {
  const start = Date.now()
  const out: any = {
    ok: true,
    now: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      AWS_REGION: process.env.AWS_REGION,
      AWS_BUCKET_NAME: !!process.env.AWS_BUCKET_NAME,
      DATABASE_URL: !!process.env.DATABASE_URL,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      CLERK_PUBLISHABLE_KEY: !!process.env.CLERK_PUBLISHABLE_KEY,
    },
  }

  // DB
  try {
    await tmo(prisma.$queryRaw`SELECT 1`)
    out.db = { ok: true }
  } catch (e: any) {
    out.db = { ok: false, error: e.message }
  }

  // S3 (permission + DNS)
  try {
    await tmo(
      s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Prefix: 'videos/',
          MaxKeys: 1,
        })
      )
    )
    out.s3 = { ok: true }
  } catch (e: any) {
    out.s3 = { ok: false, error: e.message }
  }

  // ffmpeg availability
  try {
    // @ts-ignore - optional dep is fine
    const ffmpegPath = require('ffmpeg-static') || 'ffmpeg'
    const r = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8' })
    out.ffmpeg = { ok: r.status === 0, version: (r.stdout || r.stderr).split('\n')[0] }
  } catch (e: any) {
    out.ffmpeg = { ok: false, error: e.message }
  }

  // OpenAI reachability (cheap GET)
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('NO_KEY')
    const r = await tmo(
      fetch('https://api.openai.com/v1/models?limit=1', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      }) as any
    )
    out.openai = { ok: (r as Response).ok }
  } catch (e: any) {
    out.openai = { ok: false, error: e.message }
  }

  out.durationMs = Date.now() - start
  res.json(out)
})

// (optional) prove error handler works
router.get('/health/crash', () => {
  throw new Error('Crash test')
})

export default router
