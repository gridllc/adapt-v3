import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const s3 = new S3Client({ region: process.env.AWS_REGION! })
const bucket = process.env.AWS_BUCKET_NAME!

export const videoDownloader = {
  async fromS3(key: string): Promise<string> {
    const local = join(tmpdir(), `${randomUUID()}.mp4`)
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!res.Body) throw new Error('Empty S3 body')
    await pipeline(res.Body as any, createWriteStream(local))
    return local
  },

  async getVideoDurationSeconds(localVideoPath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        localVideoPath
      ]);
      const sec = parseFloat((stdout || '0').trim());
      return Number.isFinite(sec) ? sec : 0;
    } catch (error) {
      console.warn('⚠️ Could not get video duration with ffprobe:', error);
      return 0;
    }
  },
}

// Keep the old functions for backward compatibility
export async function s3DownloadToTemp(key: string, fileName: string): Promise<string> {
  return videoDownloader.fromS3(key)
}

export function inferS3KeyForModule(opts: { id: string, s3Key?: string | null, videoUrl?: string | null }) {
  if (opts.s3Key) return opts.s3Key
  if (opts.videoUrl && opts.videoUrl.includes('/videos/')) return `videos/${opts.id}.mp4`
  return null
}
