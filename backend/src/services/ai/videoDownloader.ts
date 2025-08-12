import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

/**
 * Downloads a video from the given URL and saves it to the /temp folder.
 * Returns the full local file path.
 */
export async function downloadVideoFromUrl(videoUrl: string, moduleId?: string): Promise<string> {
  try {
    console.log(`📥 [Downloader] Downloading video for module ${moduleId || 'unknown'} from URL:`, videoUrl)

    const response = await axios.get(videoUrl, {
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
