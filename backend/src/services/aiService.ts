import { startProcessing } from './ai/aiPipeline.js'
import { ModuleService } from './moduleService.js'
import { storageService } from './storageService.js'
import { DatabaseService } from './prismaService.js'
import { v4 as uuidv4 } from 'uuid'
import { rewriteStepsWithGPT } from '../utils/transcriptFormatter.js'

// Stub for enhanced AI service since the original file was renamed
const enhancedAiService = {
  chat: async (message: string, context: any): Promise<string> => {
    console.log('⚠️ [AI Service] Enhanced AI chat not available, returning placeholder response')
    return `I'm sorry, but the enhanced AI service is not currently available. Your message was: "${message}"`
  },
  processor: {
    generateContextualResponse: async (message: string, context: any): Promise<string> => {
      console.log('⚠️ [AI Service] Enhanced AI contextual response not available, returning placeholder response')
      return `I'm sorry, but the enhanced AI contextual response service is not currently available. Your message was: "${message}"`
    }
  }
}

export type AIResult =
  | { ok: true; text: string; model: string; tokens?: number }
  | { ok: false; code: 'LLM_UNAVAILABLE'|'TIMEOUT'|'RATE_LIMIT'|'BAD_PROMPT'; detail?: string }

export const aiService = {
  /**
   * Full pipeline to generate steps from a video and save them to the module.
   * @param moduleId - ID of the module in DB
   * @param videoKey - S3 key (e.g., "videos/abc.mp4") or full URL for backward compatibility
   */
  async generateStepsForModule(moduleId: string, videoKey: string): Promise<void> {
    console.log(`🤖 [AI Service] Starting step generation for module: ${moduleId}`)
    
    // Safety check: Verify module exists and is not a mock ID
    if (moduleId.startsWith('mock_module_')) {
      throw new Error(`Cannot process mock module ID: ${moduleId}. Module must exist in database.`)
    }
    
    try {
      // Verify module exists in database before proceeding
      const module = await ModuleService.getModuleById(moduleId)
      if (!module.success || !module.module) {
        throw new Error(`Module ${moduleId} does not exist in database`)
      }
      console.log(`✅ Module verified in database: ${moduleId}`)
      
      // Use the new pipeline
      await startProcessing(moduleId)
    } catch (err) {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0, 'AI processing failed')
      throw new Error(`Step generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  /**
   * Process video without module context (for testing/development)
   */
  async processVideo(videoKey: string): Promise<void> {
    throw new Error('processVideo without moduleId is no longer supported. Use generateStepsForModule instead.')
  },

  /**
   * Chat with AI about video content
   */
  async chat(message: string, context: any): Promise<string> {
    try {
      return await enhancedAiService.chat(message, context)
    } catch (error) {
      console.error('❌ Chat error:', error)
      throw new Error('Chat failed')
    }
  },

  /**
   * Generate contextual response based on video content
   */
  async generateContextualResponse(
    userMessage: string,
    context: {
      currentStep?: any;
      allSteps: any[];
      videoTime: number;
      moduleId: string;
      userId?: string;
    }
  ): Promise<AIResult> {
    try {
      // Check if AI is enabled
      if (process.env.DISABLE_AI === 'true' || process.env.GEMINI_DISABLED === 'true') {
        return { 
          ok: false, 
          code: 'LLM_UNAVAILABLE', 
          detail: 'AI service disabled via environment variable' 
        };
      }

      // Validate input
      if (!userMessage?.trim()) {
        return { 
          ok: false, 
          code: 'BAD_PROMPT', 
          detail: 'Empty or invalid user message' 
        };
      }

      // Try Gemini first
      if (process.env.GEMINI_API_KEY && !process.env.GEMINI_DISABLED) {
        try {
          // This function is not defined in the original file, so it's commented out.
          // Assuming it's a placeholder for a function that generates a response using Gemini.
          // const geminiResponse = await generateGeminiResponse(userMessage, context);
          // if (geminiResponse && geminiResponse.trim().length > 10) {
          //   return { 
          //     ok: true, 
          //     text: geminiResponse.trim(), 
          //     model: 'gemini:gemini-pro',
          //     meta: { provider: 'gemini' }
          //   };
          // }
        } catch (error: any) {
          console.warn('⚠️ Gemini failed, trying OpenAI:', error.message);
        }
      }

      // Fallback to OpenAI
      if (process.env.OPENAI_API_KEY) {
        try {
          // This function is not defined in the original file, so it's commented out.
          // Assuming it's a placeholder for a function that generates a response using OpenAI.
          // const openaiResponse = await generateOpenAIResponse(userMessage, context);
          // if (openaiResponse && openaiResponse.trim().length > 10) {
          //   return { 
          //     ok: true, 
          //     text: openaiResponse.trim(), 
          //     model: 'openai:gpt-4o-mini',
          //     meta: { provider: 'openai' }
          //   };
          // }
        } catch (error: any) {
          console.warn('⚠️ OpenAI failed:', error.message);
        }
      }

      // No AI providers available
      return { 
        ok: false, 
        code: 'LLM_UNAVAILABLE', 
        detail: 'No AI providers configured or available' 
      };

    } catch (error: any) {
      const message = String(error?.message ?? error);
      
      // Map specific error types
      if (message.includes('rate limit') || message.includes('quota')) {
        return { ok: false, code: 'RATE_LIMIT', detail: message };
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return { ok: false, code: 'TIMEOUT', detail: message };
      }
      
      return { ok: false, code: 'LLM_UNAVAILABLE', detail: message };
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
        confidence: 1.0,
        duration: 0,
        wordCount: text.split(' ').length,
        type: 'instruction' as const
      }
      
      const rewrittenSteps = await rewriteStepsWithGPT([mockStep])
      return rewrittenSteps[0]?.rewrittenText || text
    } catch (error) {
      console.error('❌ Step rewrite error:', error)
      return text // Return original text if rewrite fails
    }
  },

  /**
   * Get steps for a module
   */
  async getSteps(moduleId: string): Promise<any[]> {
    try {
      const module = await ModuleService.getModuleById(moduleId)
      if (!module.success || !module.module) {
        console.log(`[DEBUG] Module not found for steps: ${moduleId}`)
        return []
      }
      
      // Get steps from the module
      const stepsResult = await ModuleService.getModuleSteps(moduleId)
      const steps = stepsResult.success ? stepsResult.steps : []
      console.log(`[DEBUG] Found ${steps?.length || 0} steps for module: ${moduleId}`)
      return steps || []
    } catch (error) {
      console.error(`[DEBUG] Error getting steps for module ${moduleId}:`, error)
      return []
    }
  },

  /**
   * Get job status for a module (QStash/queue/worker)
   */
  async getJobStatus(moduleId: string): Promise<any> {
    try {
      const module = await ModuleService.getModuleById(moduleId)
      if (!module.success || !module.module) {
        return { status: 'not_found', moduleId }
      }
      
      return {
        status: module.module.status,
        progress: module.module.progress,
        moduleId,
        updatedAt: module.module.updatedAt
      }
    } catch (error) {
      console.error(`[DEBUG] Error getting job status for module ${moduleId}:`, error)
      return { status: 'error', moduleId, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

/**
 * Ask AI with a simple prompt and system message
 */
export async function askAI(opts: { system?: string; prompt: string }): Promise<AIResult> {
  try {
    // call OpenAI/Gemini - example OpenAI:
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
        { role: 'user' as const, content: opts.prompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
    })
    const text = resp.choices[0]?.message?.content?.trim() || ''
    if (!text) return { ok: false, code: 'LLM_UNAVAILABLE', detail: 'empty' }
    return { ok: true, text, model: 'gpt-4o-mini' }
  } catch (e: any) {
    const m = String(e?.message ?? e)
    if (m.includes('rate')) return { ok: false, code: 'RATE_LIMIT', detail: m }
    if (m.includes('timeout')) return { ok: false, code: 'TIMEOUT', detail: m }
    return { ok: false, code: 'LLM_UNAVAILABLE', detail: m }
  }
}

export function looksLikePlaceholder(text?: string) {
  if (!text) return true
  const t = text.trim().toLowerCase()
  if (t.length < 30 && (t.includes('sorry') || t.includes('unavailable'))) return true
  if (t.includes('enhanced ai contextual response service is not currently available')) return true
  return false
}

// Re-export types for convenience
export type { Step } from './ai/types.js'