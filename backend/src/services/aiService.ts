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
}