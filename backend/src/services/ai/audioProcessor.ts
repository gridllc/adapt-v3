// ESM-safe __filename / __dirname
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

// ESM-safe import for ffmpeg-static
import ffmpegStatic from 'ffmpeg-static'
const ffmpegPath = ffmpegStatic || 'ffmpeg' // fallback if local dev has system ffmpeg
console.log('[AudioProcessor] ffmpeg:', ffmpegPath)

console.log('[AudioProcessor] ESM ready:', __filename)

export const audioProcessor = {
  async extract(videoPath: string): Promise<string> {
    const wavPath = videoPath.replace(/\.mp4$/i, '.wav')
    const args = [
      '-nostdin', '-y',              // no TTY; overwrite if exists
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '2',
      wavPath,
    ]
    try {
      console.log(`[AudioProcessor] ${videoPath} → ${wavPath}`)
      await exec(ffmpegPath as string, args, { windowsHide: true })
      return wavPath
    } catch (e: any) {
      console.error('[AudioProcessor] FFmpeg extraction failed', e?.message || e)
      throw new Error(`FFmpeg extraction failed: ${e?.stderr || e?.message || e}`)
    }
  },

  async getVideoDuration(videoPath: string): Promise<number> {
    try {
      console.log(`[AudioProcessor] Getting duration for ${videoPath}`)

      // Use ffmpeg to probe the video and get duration
      const args = [
        '-i', videoPath,
        '-f', 'null', // null output format (no output file)
        '-'
      ]

      const { stdout, stderr } = await exec(ffmpegPath as string, args, { windowsHide: true })

      // Parse duration from stderr (ffmpeg writes metadata to stderr)
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10)
        const minutes = parseInt(durationMatch[2], 10)
        const seconds = parseInt(durationMatch[3], 10)
        const centiseconds = parseInt(durationMatch[4], 10)

        const totalSeconds = hours * 3600 + minutes * 60 + seconds + centiseconds / 100
        console.log(`[AudioProcessor] Duration: ${totalSeconds}s`)
        return Math.round(totalSeconds)
      }

      throw new Error('Could not parse duration from ffmpeg output')
    } catch (e: any) {
      console.error('[AudioProcessor] Failed to get video duration', e?.message || e)
      throw new Error(`Failed to get video duration: ${e?.stderr || e?.message || e}`)
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
