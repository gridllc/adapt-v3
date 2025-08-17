// backend/src/services/aiService.ts
import OpenAI from "openai"
import fs from "fs"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

/**
 * Transcribe audio from a local file path
 */
export async function transcribeFromFile(filePath: string): Promise<string> {
  const res = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
  })
  return res.text
}

/**
 * Transcribe audio from an S3 video key (deprecated - use transcribeFromFile)
 */
export async function transcribeFromS3(videoKey: string): Promise<string> {
  throw new Error("transcribeFromS3 is deprecated - download file first, then use transcribeFromFile")
}

/**
 * Generate training steps from transcript
 */
export async function generateSteps(transcript: string) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a step extraction assistant. Break transcript into timestamped steps.",
      },
      { role: "user", content: transcript },
    ],
    temperature: 0.2,
    max_tokens: 800,
  })

  const raw = res.choices[0].message?.content || "[]"
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// Export as a service object for consistency
export const aiService = {
  transcribeFromFile,
  transcribeFromS3,
  generateSteps,
}
