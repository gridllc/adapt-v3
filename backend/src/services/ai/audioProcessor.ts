import { exec } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'

/**
 * Extracts audio from a given video file and saves as WAV.
 * Returns the full path to the output audio file.
 */
export async function extractAudioFromVideo(videoPath: string, moduleId?: string): Promise<string> {
  const audioFilename = `${uuidv4()}.wav`
  const tempDir = path.resolve('temp')
  const audioPath = path.join(tempDir, audioFilename)

  console.log(`🎧 [AudioProcessor] Module ${moduleId || 'unknown'}: Extracting audio from: ${videoPath}`)
  console.log(`🎯 [AudioProcessor] Module ${moduleId || 'unknown'}: Target WAV path: ${audioPath}`)

  // Ensure temp directory exists
  await fs.mkdir(tempDir, { recursive: true })

  // Configurable audio parameters
  const sampleRate = process.env.AUDIO_SAMPLE_RATE || '44100'
  const channels = process.env.AUDIO_CHANNELS || '2'
  const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar ${sampleRate} -ac ${channels} "${audioPath}"`

  console.log(`🔧 [AudioProcessor] Module ${moduleId || 'unknown'}: Running FFmpeg command: ${command}`)

  return new Promise((resolve, reject) => {

    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [AudioProcessor] Module ${moduleId || 'unknown'}: Audio extraction failed:`, stderr)
        // Clean up partially written audio file on failure
        await fs.unlink(audioPath).catch(() => {})
        return reject(new Error(`Module ${moduleId || 'unknown'}: FFmpeg error: ${stderr}`))
      }

      console.log(`✅ [AudioProcessor] Module ${moduleId || 'unknown'}: Audio extracted successfully:`, audioPath)
      resolve(audioPath)
    })
  })
}

/**
 * Gets video metadata including duration
 */
export async function getVideoMetadata(videoPath: string, moduleId?: string): Promise<{ duration: number }> {
  const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`
  
  console.log(`🔧 [AudioProcessor] Module ${moduleId || 'unknown'}: Running FFprobe command: ${command}`)
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [AudioProcessor] Module ${moduleId || 'unknown'}: Failed to get video metadata:`, stderr)
        return reject(new Error(`Module ${moduleId || 'unknown'}: FFprobe error: ${stderr}`))
      }

      const duration = parseFloat(stdout.trim())
      if (isNaN(duration)) {
        reject(new Error(`Module ${moduleId || 'unknown'}: Invalid duration returned from ffprobe`))
        return
      }

      console.log(`📊 [AudioProcessor] Module ${moduleId || 'unknown'}: Video duration: ${duration}s`)
      resolve({ duration })
    })
  })
}

/**
 * Truncates video to specified duration
 */
export async function truncateVideo(videoPath: string, outputPath: string, durationSeconds: number, moduleId?: string): Promise<void> {
  const command = `ffmpeg -i "${videoPath}" -t ${durationSeconds} -c copy "${outputPath}"`
  
  console.log(`🔧 [AudioProcessor] Module ${moduleId || 'unknown'}: Running FFmpeg truncate command: ${command}`)
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [AudioProcessor] Module ${moduleId || 'unknown'}: Failed to truncate video:`, stderr)
        return reject(new Error(`Module ${moduleId || 'unknown'}: FFmpeg truncate error: ${stderr}`))
      }

      console.log(`✂️ [AudioProcessor] Module ${moduleId || 'unknown'}: Video truncated to ${durationSeconds}s`)
      resolve()
    })
  })
}
