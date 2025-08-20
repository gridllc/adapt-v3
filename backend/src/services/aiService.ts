import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import OpenAI from 'openai'
import { ModuleService } from './moduleService.js'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'node:stream'

const s3 = new S3Client({ region: process.env.AWS_REGION! })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const BUCKET = process.env.AWS_BUCKET_NAME!

async function getS3Stream(key: string) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return obj.Body as Readable
}

export const aiService = {
  // Fetch the S3 object and send to Whisper for transcription
  async transcribe(moduleId: string): Promise<string> {
    const m = await ModuleService.get(moduleId)
    if (!m?.s3Key) throw new Error('missing s3Key for module')

    const stream = await getS3Stream(m.s3Key)
    // OpenAI SDK expects a Buffer; buffer the stream (small files OK)
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    const buffer = Buffer.concat(chunks)

    const resp = await openai.audio.transcriptions.create({
      file: buffer,
      model: 'whisper-1',
      response_format: 'text',
      temperature: 0.2,
    } as any)

    return String(resp)
  },

  // Generate structured steps JSON from transcript
  async generateSteps(moduleId: string, transcript: string) {
    const prompt = `
You are creating a short, concrete training outline from a video transcript.
Return strict JSON: [{"title": "...","description":"...","startTime":0,"endTime":12}, ...]

Rules:
- 3–8 steps max.
- startTime/endTime in SECONDS, integers.
- startTime must be ascending; each endTime >= startTime.
- Titles are short verbs ("Prep workspace", "Clean filter").
- If unsure about exact timing, pick reasonable guesses spaced across the video length.

Transcript:
${transcript.slice(0, 6000)}
    `.trim()

    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You return ONLY valid JSON array, nothing else.' },
        { role: 'user', content: prompt },
      ],
    })

    const text = chat.choices[0].message?.content?.trim() || '[]'
    // tolerant JSON parse
    const jsonStart = text.indexOf('['); const jsonEnd = text.lastIndexOf(']')
    const raw = jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : '[]'
    let steps: any[] = []
    try { steps = JSON.parse(raw) } catch { steps = [] }
    // fallback to one big step if empty
    if (!steps.length) steps = [{ title: 'Overview', description: 'General walkthrough', startTime: 0, endTime: 60 }]
    return steps
  },

  // Rewrite step text using AI for clarity
  async rewriteStep(text: string, style?: string): Promise<string> {
    try {
      const prompt = `
Rewrite this training step text to be ${style || 'clear and actionable'}:

Original: "${text}"

Rules:
- Keep it concise and actionable
- Use imperative verbs when possible
- Make it easy to follow step-by-step
- Maintain the same meaning and intent

Rewritten text:`

      const chat = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a training content editor. Return only the rewritten text, nothing else.' },
          { role: 'user', content: prompt },
        ],
      })

      return chat.choices[0].message?.content?.trim() || text
    } catch (error) {
      console.error('❌ Step rewrite error:', error)
      return text // Return original text if rewrite fails
    }
  },
}