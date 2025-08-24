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
const MAX_MB = parseInt(process.env.MAX_TRANSCRIBE_MB || '50', 10)
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
    const whisperLimit = 25 * 1024 * 1024 // OpenAI Whisper 25MB limit
    const downloadLimit = 50 * 1024 * 1024 // Support up to 50MB videos
    
    if (bytes > downloadLimit) throw new Error(`TOO_LARGE: ${(bytes/1e6|0)}MB > ${MAX_MB}MB cap`)

    const tmp = await downloadToTemp(m.s3Key, moduleId)
    let fileToProcess = tmp
    
    try {
      // If file is too large for Whisper, compress it
      if (bytes > whisperLimit) {
        console.log(`📦 [TRANSCRIBE] File too large for Whisper (${(bytes/1e6).toFixed(1)}MB), compressing...`)
        fileToProcess = await this.compressVideoForWhisper(tmp, moduleId)
        console.log(`✅ [TRANSCRIBE] Compressed video ready for Whisper`)
      }
      
      const file = fs.createReadStream(fileToProcess) as any
      const resp = await openai.audio.transcriptions.create({
        file, model: 'whisper-1', response_format: 'text', temperature: 0.2
      } as any)
      return String(resp)
    } finally {
      // Clean up both original and compressed files
      fs.promises.unlink(tmp).catch(()=>{})
      if (fileToProcess !== tmp) {
        fs.promises.unlink(fileToProcess).catch(()=>{})
      }
    }
  },

  // Compress video to fit Whisper's 25MB limit
  async compressVideoForWhisper(inputPath: string, moduleId: string): Promise<string> {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    const outputPath = inputPath.replace('.mp4', '-compressed.mp4')
    
    try {
      // Compress video with ffmpeg - reduce bitrate and resolution if needed
      const cmd = `ffmpeg -i "${inputPath}" -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 64k -ac 1 -ar 22050 "${outputPath}"`
      
      console.log(`🔧 [COMPRESS] Running ffmpeg compression for ${moduleId}`)
      await execAsync(cmd)
      
      const { stat } = await import('fs/promises')
      const compressedSize = (await stat(outputPath)).size
      
      console.log(`📊 [COMPRESS] Compressed to ${(compressedSize/1e6).toFixed(1)}MB`)
      
      // If still too large, try more aggressive compression
      if (compressedSize > 24 * 1024 * 1024) {
        const aggressivePath = inputPath.replace('.mp4', '-aggressive.mp4')
        const aggressiveCmd = `ffmpeg -i "${inputPath}" -c:v libx264 -crf 32 -preset fast -vf "scale=-2:360" -c:a aac -b:a 32k -ac 1 -ar 16000 "${aggressivePath}"`
        
        console.log(`🔧 [COMPRESS] File still too large, applying aggressive compression`)
        await execAsync(aggressiveCmd)
        
        // Clean up intermediate file
        fs.promises.unlink(outputPath).catch(()=>{})
        return aggressivePath
      }
      
      return outputPath
    } catch (error: any) {
      console.error(`❌ [COMPRESS] FFmpeg compression failed:`, error.message)
      throw new Error(`Video compression failed: ${error.message}`)
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

  // Legacy method - keep for backward compatibility
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

  /**
   * Enhanced Q&A method with better context prioritization
   * @param input - Contains module, steps, transcript, focus window, and question
   * @returns {answer, sources} with detailed source tracking
   */
  async buildQaContextAndAsk(input: {
    module: { id: string; title: string };
    steps: Array<{ 
      id: string; 
      text: string; 
      startTime?: number; 
      endTime?: number; 
      aliases?: string[]; 
      notes?: string;
      order?: number;
    }>;
    transcript: string;
    focusWindow?: { start?: number; end?: number };
    question: string;
    mode?: 'brief' | 'normal';
  }): Promise<{ answer: string; sources: Array<{
    type: 'step' | 'transcript';
    id?: string;
    startTime?: number;
    endTime?: number;
    snippet: string;
    orderHint?: number;
  }> }> {
    try {
      // Prioritize steps based on focus window or use all steps
      const prioritizedSteps = (() => {
        if (!input.focusWindow?.start && !input.focusWindow?.end) {
          // No focus window - return first 8 steps ordered by sequence
          return input.steps
            .sort((a, b) => (a.order ?? a.startTime ?? 0) - (b.order ?? b.startTime ?? 0))
            .slice(0, 8);
        }
        
        // Calculate center of focus window
        const focusCenter = (Number(input.focusWindow?.start ?? 0) + Number(input.focusWindow?.end ?? 0)) / 2;
        
        // Sort steps by proximity to focus center, then take top 8
        return [...input.steps]
          .sort((a, b) => {
            const aCenter = ((a.startTime ?? 0) + (a.endTime ?? 0)) / 2;
            const bCenter = ((b.startTime ?? 0) + (b.endTime ?? 0)) / 2;
            return Math.abs(aCenter - focusCenter) - Math.abs(bCenter - focusCenter);
          })
          .slice(0, 8);
      })();

      // Build enhanced system prompt based on mode
      const isBrief = input.mode === 'brief';
      const systemPrompt = isBrief 
        ? `You are Adapt Tutor. Default style = BRIEF.
Rules:
1) Answer in one short paragraph (<= 25 words) unless user says "details" or asks "why/how".
2) If the user asks for a specific step, return ONLY that step in one line: "Step N: <text>".
3) No preambles like "Sure" or "According to the steps".
4) Never restate previous steps unless explicitly requested.
5) Be direct and concise.`
        : `You are an AI training tutor answering questions about a specific training video.
Use the provided STEPS (with timestamps) and TRANSCRIPT excerpts to give accurate, practical answers.
Be concise and reference specific step numbers when relevant.
If the information isn't available, explain what you do know and suggest the closest relevant step.`;

      // Build structured user prompt
      const userPrompt = [
        `Module: ${input.module.title} (ID: ${input.module.id})`,
        ``,
        `QUESTION: ${input.question}`,
        ``,
        `RELEVANT STEPS:`,
        ...prioritizedSteps.map((step, index) => {
          const timeRange = (step.startTime !== undefined && step.endTime !== undefined) 
            ? `[${step.startTime}s-${step.endTime}s]` 
            : '[time unknown]';
          
          let stepText = `${index + 1}. ${timeRange} ${step.text}`;
          
          if (step.aliases && step.aliases.length > 0) {
            stepText += ` (also called: ${step.aliases.join(', ')})`;
          }
          
          if (step.notes) {
            stepText += ` [NOTE: ${step.notes}]`;
          }
          
          return stepText;
        }),
        ``,
        `TRANSCRIPT EXCERPT:`,
        input.transcript.slice(0, 4000) + (input.transcript.length > 4000 ? '...' : ''),
        ``,
        `Please provide a clear, step-by-step answer. Reference specific step numbers when applicable.`
      ].join('\n');

      // Generate response using OpenAI with mode-specific parameters
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: isBrief ? 0.1 : 0.2,
        max_tokens: isBrief ? 60 : 500,
        top_p: isBrief ? 0.8 : 1.0,
        stop: isBrief ? ['\n\n'] : undefined,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const answer = response.choices[0]?.message?.content?.trim() || 'No answer could be generated.';

      // Build sources array with enhanced metadata
      const sources = [
        // Add transcript as a source if it exists
        ...(input.transcript ? [{
          type: 'transcript' as const,
          snippet: input.transcript.length > 200 
            ? input.transcript.substring(0, 200) + '...' 
            : input.transcript
        }] : []),
        // Add prioritized steps as sources
        ...prioritizedSteps.map((step, index) => ({
          type: 'step' as const,
          id: step.id,
          startTime: step.startTime,
          endTime: step.endTime,
          snippet: step.text?.slice(0, 160) ?? '',
          orderHint: index + 1,
        }))
      ];

      return { answer, sources };
      
    } catch (error) {
      console.error('❌ buildQaContextAndAsk error:', error);
      
      // Fallback to simple response
      return {
        answer: 'I apologize, but I encountered an error while processing your question. Please try again.',
        sources: []
      };
    }
  },
}