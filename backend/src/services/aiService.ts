import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import OpenAI from 'openai'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline as _pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { ModuleService } from './moduleService.js'

const pipeline = promisify(_pipeline)
const s3 = new S3Client({ region: process.env.AWS_REGION! })
const BUCKET = process.env.AWS_BUCKET_NAME!
const MAX_MB = parseInt(process.env.MAX_TRANSCRIBE_MB || '60', 10)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function headSize(key: string) {
  const h = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
  return Number(h.ContentLength || 0)
}
async function downloadToTemp(key: string, moduleId: string) {
  const tmp = path.join(os.tmpdir(), `${moduleId}-${Date.now()}.mp4`)
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  await pipeline(obj.Body as any, fs.createWriteStream(tmp))
  return tmp
}

export const aiService = {
  async transcribe(moduleId: string): Promise<string> {
    const m = await ModuleService.get(moduleId)
    if (!m?.s3Key) throw new Error('missing s3Key')

    const bytes = await headSize(m.s3Key)
    const limit = MAX_MB * 1024 * 1024
    if (bytes > limit) throw new Error(`TOO_LARGE: ${(bytes/1e6|0)}MB > ${MAX_MB}MB cap`)

    const tmp = await downloadToTemp(m.s3Key, moduleId)
    try {
      const file = fs.createReadStream(tmp) as any
      const resp = await openai.audio.transcriptions.create({
        file, model: 'whisper-1', response_format: 'text', temperature: 0.2
      } as any)
      return String(resp)
    } finally {
      fs.promises.unlink(tmp).catch(()=>{})
    }
  },

  async generateSteps(_moduleId: string, transcript: string) {
    const prompt = `
Return ONLY a JSON array like:
[{"title":"…","description":"…","startTime":0,"endTime":12}, …]
- 3–8 steps; start/end are integers (seconds)
- short, action titles
Transcript:
${transcript.slice(0, 6000)}
`.trim()

    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Reply with ONLY a valid JSON array. No prose.' },
        { role: 'user', content: prompt },
      ],
    })
    const txt = r.choices[0].message?.content?.trim() ?? '[]'
    const s = txt.includes('[') ? txt.slice(txt.indexOf('['), txt.lastIndexOf(']')+1) : '[]'
    try { return JSON.parse(s) } catch { return [{ title:'Overview', description:'General walkthrough', startTime:0, endTime:30 }] }
  },

  async rewriteStep(text: string, style: string): Promise<string> {
    const prompt = `Rewrite the following text in a ${style} style. Keep the same meaning but adjust the tone and language to match the requested style:

Text: "${text}"

Style: ${style}

Return only the rewritten text, no additional commentary.`

    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a helpful writing assistant. Rewrite the given text in the requested style.' },
        { role: 'user', content: prompt },
      ],
    })
    
    return r.choices[0].message?.content?.trim() ?? text
  },

  async chat(message: string, context: any = {}): Promise<string> {
    const prompt = `You are a helpful AI tutor. Answer the following question based on the provided context:

Context: ${JSON.stringify(context)}

Question: ${message}

Provide a clear, helpful response.`

    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a helpful AI tutor.' },
        { role: 'user', content: prompt },
      ],
    })
    
    return r.choices[0].message?.content?.trim() ?? 'I apologize, but I could not generate a response at this time.'
  },

  async processVideo(videoUrl: string): Promise<any> {
    // Placeholder implementation - this would typically process video files
    console.log(`Processing video: ${videoUrl}`)
    return { status: 'processed', url: videoUrl }
  },

  async generateStepsForModule(moduleId: string, videoUrl: string): Promise<any> {
    // Placeholder implementation - this would generate steps for a module
    console.log(`Generating steps for module: ${moduleId}`)
    return { status: 'steps_generated', moduleId }
  },

  async generateContextualResponse(message: string, context: any): Promise<string> {
    const prompt = `Based on the following context, provide a helpful response to the user's message:

Context: ${JSON.stringify(context)}

User Message: ${message}

Provide a relevant and helpful response.`

    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt },
      ],
    })
    
    return r.choices[0].message?.content?.trim() ?? 'I apologize, but I could not generate a response at this time.'
  },

  async getSteps(moduleId: string): Promise<any[]> {
    // Placeholder implementation - this would retrieve steps for a module
    console.log(`Getting steps for module: ${moduleId}`)
    return []
  },

  async getJobStatus(jobId: string): Promise<any> {
    // Placeholder implementation - this would check job status
    console.log(`Getting job status for: ${jobId}`)
    return { status: 'completed', jobId }
  },
}