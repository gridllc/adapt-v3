import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const TEMP_DIR = process.env.TEMP_DIR || '/app/temp'
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! }
    : undefined
})

async function ensureTempDir() {
  await fsp.mkdir(TEMP_DIR, { recursive: true })
}

export async function s3DownloadToTemp(key: string, fileName: string): Promise<string> {
  await ensureTempDir()
  const outPath = path.join(TEMP_DIR, fileName)
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key: key }))
  if (!res.Body) throw new Error(`S3 getObject empty: ${key}`)
  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(outPath)
    ;(res.Body as any).pipe(ws)
    ws.on('finish', () => resolve())
    ws.on('error', reject)
  })
  return outPath
}

export function inferS3KeyForModule(opts: { id: string, s3Key?: string | null, videoUrl?: string | null }) {
  if (opts.s3Key) return opts.s3Key
  if (opts.videoUrl && opts.videoUrl.includes('/videos/')) return `videos/${opts.id}.mp4`
  return null
}
