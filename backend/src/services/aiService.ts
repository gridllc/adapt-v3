// aiService.ts
import { Readable } from 'node:stream'

// ---- OpenAI (primary) ----
import OpenAI from "openai"

// ---- Gemini (fallback - disabled for now) ----
// import { GoogleGenerativeAI } from "@google/generative-ai"

const {
  OPENAI_API_KEY,
  // GEMINI_API_KEY, // Disabled for now
} = process.env

// const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

export type StartTextStreamArgs = {
  moduleId?: string
  question: string
  context?: {
    steps?: Array<any>
    currentStep?: any
    videoTime?: number
  }
}

/**
 * Returns a Node Readable stream of UTF-8 text chunks.
 * Use in Express: stream.on('data', chunk => res.write(chunk))
 */
export async function startTextStream({
  moduleId, question, context
}: StartTextStreamArgs): Promise<Readable> {
  // OpenAI streaming (primary)
  if (openai) {
    try {
      const sys = `You are a friendly training assistant. Module: ${moduleId ?? 'unknown'}.`
      const user = renderPrompt(question, context)

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ],
        temperature: 0.2,
      })

      const out = new Readable({ read() {} })
      ;(async () => {
        for await (const part of response) {
          const delta = part.choices?.[0]?.delta?.content
          if (delta) out.push(delta)
        }
        out.push(null)
      })().catch(err => out.destroy(err))
      return out
    } catch (err) {
      console.error("OpenAI stream failed:", err)
      throw new Error("OpenAI streaming failed")
    }
  }

  // Fallback: Error if no AI provider available
  throw new Error("No AI provider available. Set OPENAI_API_KEY.")
}

function renderPrompt(question: string, ctx?: StartTextStreamArgs["context"]) {
  const { steps = [], currentStep, videoTime } = ctx || {}
  const stepMsg = currentStep
    ? `Current step ${currentStep.stepNumber}: "${currentStep.title}" (${Math.floor(currentStep.start)}s–${Math.floor(currentStep.end)}s).`
    : `No current step.`
  const overview = steps?.length ? `Total steps: ${steps.length}.` : `No steps loaded.`
  const vt = typeof videoTime === 'number' ? `Video time ~${Math.floor(videoTime)}s.` : ''
  return `${stepMsg}\n${overview}\n${vt}\n\nUser: ${question}`
}

// Keep existing functions for backward compatibility
export const aiService = {
  async chat(message: string, context: any): Promise<string> {
    try {
      // For backward compatibility, collect the stream into a string
      const stream = await startTextStream({ question: message, context })
      let result = ''
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          result += chunk.toString()
        })
        stream.on('end', () => resolve(result))
        stream.on('error', reject)
      })
    } catch (error) {
      console.error('❌ Chat error:', error)
      throw new Error('Chat failed')
    }
  },

  /**
   * Generate contextual response based on video content
   */
  async generateContextualResponse(message: string, context: any): Promise<string> {
    try {
      // For backward compatibility, collect the stream into a string
      const stream = await startTextStream({ 
        question: message, 
        context: {
          steps: context.allSteps,
          currentStep: context.currentStep,
          videoTime: context.videoTime
        }
      })
      let result = ''
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          result += chunk.toString()
        })
        stream.on('end', () => resolve(result))
        stream.on('error', reject)
      })
    } catch (error) {
      console.error('❌ Contextual response error:', error)
      throw new Error('Contextual response failed')
    }
  },

  /**
   * Rewrite step text using AI for clarity
   */
  async rewriteStep(text: string, style?: string): Promise<string> {
    try {
      // Create a mock step structure for the rewrite function
      const mockStep = {
        id: 'temp',
        text: text,
        start: 0,
        end: 0,
        confidence: 1.0
      }
      
      const stream = await startTextStream({ 
        question: `Rewrite this step text to be clearer and more helpful: "${text}"`,
        context: { steps: [mockStep] }
      })
      let result = ''
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          result += chunk.toString()
        })
        stream.on('end', () => resolve(result))
        stream.on('error', reject)
      })
    } catch (error) {
      console.error('❌ Step rewrite error:', error)
      throw new Error('Step rewrite failed')
    }
  },

  /**
   * Process video without module context (for testing/development)
   */
  async processVideo(videoKey: string): Promise<void> {
    throw new Error('processVideo without moduleId is no longer supported. Use generateStepsForModule instead.')
  },

  /**
   * Generate steps for a module (for backward compatibility)
   */
  async generateStepsForModule(moduleId: string, videoKey: string): Promise<void> {
    console.log(`🤖 [AI Service] Starting step generation for module: ${moduleId}`)
    // This function is kept for backward compatibility but should be replaced
    // with the new pipeline system
    throw new Error('generateStepsForModule is deprecated. Use the new pipeline system instead.')
  },

  /**
   * Get steps for a module (for backward compatibility)
   */
  async getSteps(moduleId: string): Promise<any[]> {
    try {
      // This is a placeholder - implement based on your database service
      console.log(`[DEBUG] Getting steps for module: ${moduleId}`)
      return []
    } catch (error) {
      console.error(`[DEBUG] Error getting steps for module ${moduleId}:`, error)
      return []
    }
  },

  /**
   * Get job status for a module (for backward compatibility)
   */
  async getJobStatus(moduleId: string): Promise<any> {
    try {
      // This is a placeholder - implement based on your database service
      console.log(`[DEBUG] Getting job status for module: ${moduleId}`)
      return { status: 'unknown', moduleId }
    } catch (error) {
      console.error(`[DEBUG] Error getting job status for module ${moduleId}:`, error)
      return { status: 'error', moduleId, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

// Re-export types for convenience
export type { Step } from './ai/types.js'