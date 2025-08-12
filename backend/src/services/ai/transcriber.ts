import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const model = process.env.WHISPER_MODEL || 'base' // 👈 Configurable model

export interface TranscriptionResult {
  text: string
  segments: Array<{
    start: number
    end: number
    text: string
  }>
}

/**
 * Transcribe the provided WAV file using Whisper (local or API).
 * Returns the transcript text and segments.
 */
export async function transcribeAudio(audioPath: string, moduleId?: string): Promise<TranscriptionResult> {
  const transcriptDir = path.dirname(audioPath)
  const tempOutputPath = path.join(transcriptDir, 'transcript.txt')
  const jsonOutputPath = path.join(transcriptDir, 'transcript.json')

  try {
    console.log(`🎙️ [Transcriber] Transcribing audio for module ${moduleId || 'unknown'}: ${audioPath}`)

    const jsonCommand = `whisper "${audioPath}" --model ${model} --output_format json --output_dir "${transcriptDir}"`
    console.log(`🔍 [Transcriber] JSON command: ${jsonCommand}`)

    try {
      await execAsync(jsonCommand)

      if (fs.existsSync(jsonOutputPath)) {
        const jsonData = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf-8'))

        const segments = jsonData.segments?.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text.trim()
        })) || []

        // Extract text from segments if JSON parsing failed
        const text = jsonData.text || segments.map((s: { start: number; end: number; text: string }) => s.text).join(' ')

        console.log(`✅ [Transcriber] Module ${moduleId || 'unknown'}: Transcription complete with segments`)
        return { text, segments }
      } else {
        throw new Error('JSON file not found after transcription')
      }
    } catch (jsonError) {
      console.warn(`⚠️ [Transcriber] Module ${moduleId || 'unknown'}: JSON transcription error:`, jsonError)
      console.log('⚠️ [Transcriber] Falling back to text-only transcription...')
    }

    const textCommand = `whisper "${audioPath}" --model ${model} --output_format txt --output_dir "${transcriptDir}"`
    console.log(`🔍 [Transcriber] Text fallback command: ${textCommand}`)
    await execAsync(textCommand)

    const transcript = fs.readFileSync(tempOutputPath, 'utf-8')
    console.log(`✅ [Transcriber] Module ${moduleId || 'unknown'}: Transcription complete (text only)`)

    return {
      text: transcript,
      segments: [{
        start: 0,
        end: 0, // Unknown without timestamps
        text: transcript.trim()
      }]
    }

  } catch (error) {
    console.error(`❌ [Transcriber] Module ${moduleId || 'unknown'}: Transcription failed:`, error)
    throw new Error('Transcription error: ' + (error instanceof Error ? error.message : 'Unknown error'))
  } finally {
    // 🧹 Clean up temp files
    fs.existsSync(tempOutputPath) && fs.unlinkSync(tempOutputPath)
    fs.existsSync(jsonOutputPath) && fs.unlinkSync(jsonOutputPath)
  }
}