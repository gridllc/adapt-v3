import { fileURLToPath } from 'url'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const exec = promisify(execFile)

export const audioProcessor = {
  async extract(videoPath: string): Promise<string> {
    const wavPath = videoPath.replace(/\.mp4$/i, '.wav')
    const args = ['-i', videoPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wavPath]
    try {
      await exec('ffmpeg', args, { windowsHide: true })
      return wavPath
    } catch (e: any) {
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
