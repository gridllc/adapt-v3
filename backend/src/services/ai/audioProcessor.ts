// ESM-safe __filename / __dirname
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

// Use ffmpeg-static for better Render compatibility
let ffmpegPath: string
try {
  ffmpegPath = require('ffmpeg-static')
  console.log('[AudioProcessor] Using ffmpeg-static:', ffmpegPath)
} catch (e) {
  ffmpegPath = 'ffmpeg' // fallback to system ffmpeg
  console.log('[AudioProcessor] ffmpeg-static not available, using system ffmpeg')
}

console.log('[AudioProcessor] ESM ready:', __filename)

export const audioProcessor = {
  async extract(videoPath: string): Promise<string> {
    const wavPath = videoPath.replace(/\.mp4$/i, '.wav')
    const args = ['-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wavPath]
    try {
      console.log(`[AudioProcessor] Extracting audio: ${videoPath} -> ${wavPath}`)
      await exec(ffmpegPath, args, { windowsHide: true })
      console.log(`[AudioProcessor] Audio extraction complete: ${wavPath}`)
      return wavPath
    } catch (e: any) {
      console.error(`[AudioProcessor] FFmpeg extraction failed:`, e)
      throw new Error(`FFmpeg extraction failed: ${e?.stderr || e?.message || e}`)
    }
  },
}

// Keep the old functions for backward compatibility
export async function extractAudioWavForModule(moduleId: string) {
  // This function is now deprecated in favor of the new pipeline
  throw new Error('extractAudioWavForModule is deprecated. Use audioProcessor.extract() instead.')
}

export async function cleanupTemp(paths: string[]) {
  // This function is now handled by the OS temp directory cleanup
  console.log('Temp files will be cleaned up automatically by the OS')
}
