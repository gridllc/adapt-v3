import fs from "fs"
import path from "path"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

/**
 * Transcribe a WAV (or MP3/MP4) file at `audioPath` into plain text.
 * Returns text; keeps the file handling minimal.
 */
export async function transcribeAudio(audioPath: string, moduleId: string): Promise<{ text: string; segments: any[] }> {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Transcriber: audio not found at ${audioPath}`)
  }

  console.log(`🎤 [Transcriber] Starting transcription for module ${moduleId}, audio: ${audioPath}`)

  try {
    // Prefer whisper-1 for accuracy/cost; if you've enabled gpt-4o-mini-transcribe you can swap model.
    const resp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath) as any,
      model: "whisper-1",
      // language: "en", // uncomment if you want to force language
      // response_format: "text" // default already text
    })

    const text = typeof resp === "string" ? resp : (resp.text ?? "")
    if (!text.trim()) throw new Error("Transcriber: got empty transcript")

    console.log(`✅ [Transcriber] Transcription complete for module ${moduleId}, length: ${text.length}`)

    // Return in the expected format for compatibility
    return {
      text,
      segments: [] // OpenAI API doesn't return segments by default, but we can add them later if needed
    }
  } catch (error) {
    console.error(`❌ [Transcriber] Failed for module ${moduleId}:`, error)
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
