// backend/src/services/aiService.ts
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

/**
 * Transcribe audio from an S3 video key
 */
export async function transcribeFromS3(videoKey: string): Promise<string> {
  // For now, assume video already in S3, and we fetch signed URL
  // Later can extract audio if needed
  const url = `${process.env.CDN_BASE_URL}/${videoKey}`
  const res = await openai.audio.transcriptions.create({
    file: url,
    model: "whisper-1",
  })
  return res.text
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
