import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { URL } from 'url'
import { getApiBaseUrl } from '../../config/env.js'

/**
 * Normalizes input to S3 key format.
 * Converts full URLs to S3 keys and handles legacy callers.
 */
function toS3Key(input: string): string {
  if (!/^https?:\/\//i.test(input)) return input.replace(/^\/+/, '')

  const u = new URL(input)
  // S3 V2 style: https://adaptv3-training-videos.s3.us-west-1.amazonaws.com/videos/abc.mp4
  // S3 V1 path style or CDN: just grab pathname
  const pathname = u.pathname.replace(/^\/+/, '')
  // If the pathname starts with the bucket name (rare), strip it
  if (pathname.startsWith(process.env.AWS_BUCKET_NAME! + '/')) {
    return pathname.slice(process.env.AWS_BUCKET_NAME!.length + 1)
  }
  return pathname
}

/**
 * Downloads a video from S3 using a signed URL.
 * Accepts either S3 keys or full URLs for backward compatibility.
 * Returns the full local file path.
 */
export async function downloadVideoFromUrl(videoUrl: string, moduleId?: string): Promise<string> {
  try {
    console.log(`📥 [Downloader] Downloading video for module ${moduleId || 'unknown'} from URL:`, videoUrl)

    // Convert to S3 key if it's a full URL
    const key = toS3Key(videoUrl)
    console.log(`🔑 [Downloader] Using S3 key:`, key)

    // Get signed URL from backend
    const apiBaseUrl = getApiBaseUrl()
    const { data } = await axios.get<{ url: string }>(
      `${apiBaseUrl}/api/storage/signed-url`,
      { params: { key } }
    )
    const signedUrl = data.url

    console.log(`🔗 [Downloader] Got signed URL for key:`, key)

    const response = await axios.get(signedUrl, {
      responseType: 'stream',
      headers: {
        // Required for presigned S3 URLs
        'Content-Type': 'application/octet-stream',
      },
      timeout: 30000,
    })

    const videoFilename = `${uuidv4()}.mp4`
    const tempDir = path.resolve('temp')
    const fullPath = path.join(tempDir, videoFilename)

    await fs.promises.mkdir(tempDir, { recursive: true })

    const writer = fs.createWriteStream(fullPath)
    response.data.pipe(writer)

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })

    console.log(`✅ [Downloader] Module ${moduleId || 'unknown'} downloaded to:`, fullPath)
    return fullPath
  } catch (error) {
    console.error(`❌ [Downloader] Module ${moduleId || 'unknown'} download error:`, error instanceof Error ? error.message : 'Unknown error')
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    throw new Error('Failed to download video: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Downloads an S3 object using a signed URL.
 * This is the new preferred method that works with S3 keys.
 */
export async function downloadS3Object(keyOrUrl: string): Promise<Buffer> {
  const key = toS3Key(keyOrUrl)
  
  // Call your backend to get a signed URL
  const apiBaseUrl = getApiBaseUrl()
  const { data } = await axios.get<{ url: string }>(
    `${apiBaseUrl}/api/storage/signed-url`,
    { params: { key } }
  )
  const signedUrl = data.url

  const resp = await axios.get<ArrayBuffer>(signedUrl, {
    responseType: 'arraybuffer',
  })
  return Buffer.from(resp.data)
}
