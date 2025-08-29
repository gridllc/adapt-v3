
import { ModuleService } from './moduleService.js'
import { storageService } from './storageService.js'
import { DatabaseService } from './prismaService.js'
import { prisma } from '../config/database.js'
import { v4 as uuidv4 } from 'uuid'
import { rewriteStepsWithGPT } from '../utils/transcriptFormatter.js'
import { findSimilarInteractions, findBestMatchingAnswer } from './qaRecall.js'
import { generateEmbedding, logInteractionToVectorDB } from '../utils/vectorUtils.js'
import OpenAI from 'openai'

// Utility function to sanitize AI responses
function sanitizeAssistantResponse(text: string): string {
  return text
    // Remove timestamp lines like "Starts at 0:00 in the video."
    .replace(/^\s*start[s]?\s+at\s+\d{1,2}:\d{2}.*$/gim, '')
    // Remove other common timestamp patterns
    .replace(/^\s*at\s+\d{1,2}:\d{2}.*$/gim, '')
    .replace(/^\s*@\s+\d{1,2}:\d{2}.*$/gim, '')
    // Remove video timing references
    .replace(/^\s*in\s+the\s+video.*$/gim, '')
    .replace(/^\s*at\s+\d{1,2}:\d{2}\s+in\s+the\s+video.*$/gim, '')
    // Clean up extra whitespace and empty lines
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s*$/gm, '')
    .trim()
}

// Initialize OpenAI for enhanced AI responses
let openai: OpenAI | undefined
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    console.log('✅ [AI Service] OpenAI initialized for enhanced responses')
  } else {
    console.log('⚠️ [AI Service] OpenAI API key not found - using basic responses only')
  }
} catch (error) {
  console.error('❌ [AI Service] Failed to initialize OpenAI:', error)
}

// Real AI Learning Service with Shared Knowledge Base
const enhancedAiService = {
  async chat(message: string, context: any): Promise<string> {
    try {
      console.log(`🤖 [AI Chat] Processing: "${message.substring(0, 50)}..."`)

      const { moduleId, userId } = context || {}

      // Try to find similar questions from the learning database
      const similarInteractions = await findSimilarInteractions({
        question: message,
        moduleId,
        similarityThreshold: 0.85,
        maxResults: 3
      })

      if (similarInteractions.length > 0) {
        const bestMatch = similarInteractions[0]
        console.log(`📚 [AI Chat] Found similar question (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`)

        // Generate enhanced response using the similar interaction
        return await this.generateEnhancedResponse(message, bestMatch, context)
      }

      // No similar questions found, generate fresh response
      console.log(`🆕 [AI Chat] No similar questions found, generating fresh response`)
      return await this.generateFreshResponse(message, context)

    } catch (error) {
      console.error('❌ [AI Chat] Error:', error)
      return `I'm having trouble processing your request right now. Please try again in a moment.`
    }
  },

  processor: {
    async generateContextualResponse(message: string, context: any): Promise<string> {
      try {
        console.log(`🎯 [Contextual AI] Processing: "${message.substring(0, 50)}..."`)

        const { currentStep, allSteps, videoTime, moduleId, userId } = context || {}

        // Step 1: Try to reuse existing answers (FAST PATH - no RAG for simple queries)
        const isSimpleQuery = message.length < 50 && (
          message.toLowerCase().includes('next') ||
          message.toLowerCase().includes('current') ||
          message.toLowerCase().includes('how many') ||
          /^\s*step\s+\d+\s*$/i.test(message) ||
          /^\s*what.*step\s+\d+/i.test(message)
        )

        let reuseResult = null
        if (!isSimpleQuery) {
          // Parallelize RAG search with context preparation
          const [ragResult, contextPrep] = await Promise.all([
            findBestMatchingAnswer(message, moduleId, 0.85),
            this.prepareOptimizedContext(message, context) // Pre-compute context
          ])

          if (ragResult) {
            console.log(`♻️ [Contextual AI] Reusing answer (similarity: ${(ragResult.similarity * 100).toFixed(1)}%)`)

            // Log the reuse for learning (non-blocking)
            DatabaseService.createActivityLog({
              userId: userId || undefined,
              action: 'AI_QUESTION_REUSED',
              targetId: moduleId,
              metadata: {
                originalQuestionId: ragResult.questionId,
                similarity: ragResult.similarity,
                reason: ragResult.reason
              }
            }).catch(err => console.warn('Failed to log reuse activity:', err))

            return ragResult.answer
          }
        }

        // Step 2: Generate fresh contextual response with optimized context
        console.log(`🧠 [Contextual AI] Generating fresh contextual response`)
        const optimizedContext = await this.prepareOptimizedContext(message, context)
        const freshResponse = await this.generateContextualResponse(message, optimizedContext)

        // Step 3: Log interaction for future learning (non-blocking)
        logInteractionToVectorDB({
          question: message,
          answer: freshResponse,
          moduleId: moduleId || 'global',
          stepId: currentStep?.id,
          userId,
          videoTime
        }).catch(logError => console.warn('⚠️ [Contextual AI] Failed to log interaction:', logError))

        return freshResponse

      } catch (error) {
        console.error('❌ [Contextual AI] Error:', error)
        return `I'm having trouble processing your request right now. Please try again in a moment.`
      }
    },

    async prepareOptimizedContext(message: string, context: any): Promise<any> {
      // Only include essential context to reduce prompt size
      const { currentStep, allSteps, videoTime, moduleId } = context || {}

      // For complex queries, include minimal context
      // For simple queries, include even less
      const isSimpleQuery = message.length < 100

      if (isSimpleQuery) {
        return {
          currentStep: currentStep ? {
            title: currentStep.title,
            description: currentStep.description?.substring(0, 150)
          } : null,
          allSteps: [], // Don't include all steps for simple queries
          videoTime,
          moduleId
        }
      }

      // For complex queries, include current step + 2 neighbors
      const currentIndex = allSteps?.findIndex((s: any) => s.id === currentStep?.id) ?? -1
      const neighborSteps = currentIndex >= 0 ? allSteps.slice(
        Math.max(0, currentIndex - 1),
        Math.min(allSteps.length, currentIndex + 2)
      ).map((s: any) => ({ title: s.title, description: s.description?.substring(0, 100) })) : []

      return {
        currentStep: currentStep ? {
          title: currentStep.title,
          description: currentStep.description?.substring(0, 200)
        } : null,
        allSteps: neighborSteps,
        videoTime,
        moduleId
      }
    },

    async generateStreamingContextualResponse(message: string, context: any): Promise<any> {
      const { currentStep, allSteps, videoTime, moduleId, userId } = context || {}

      // For streaming, we need to be even more aggressive about context size
      const trimmedContext = {
        currentStep: currentStep ? {
          title: currentStep.title,
          description: currentStep.description?.substring(0, 200)
        } : null,
        neighborSteps: allSteps?.slice(
          Math.max(0, allSteps.findIndex((s: any) => s.id === currentStep?.id) - 1),
          Math.min(allSteps.length, allSteps.findIndex((s: any) => s.id === currentStep?.id) + 2)
        ).map((s: any) => ({ title: s.title, order: s.order })) || [],
        moduleId,
        videoTime
      }

      // Build compact prompt
      const prompt = `You are helping with a training video. Current context:
${trimmedContext.currentStep ? `Current step: ${trimmedContext.currentStep.title}
${trimmedContext.currentStep.description ? `Description: ${trimmedContext.currentStep.description}` : ''}` : 'No current step'}

${trimmedContext.neighborSteps.length > 0 ? `Nearby steps: ${trimmedContext.neighborSteps.map((s: any) => `Step ${s.order}: ${s.title}`).join(', ')}` : ''}

Question: ${message}

Provide a concise, practical answer. Do not mention video timestamps.`

      // Use OpenAI streaming
      if (!openai) {
        throw new Error('OpenAI not initialized')
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: 'Give practical step guidance. Do NOT mention video timestamps.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 300
      })

      const passThrough = new PassThrough()

      response.on('data', (chunk) => {
        const content = chunk.choices?.[0]?.delta?.content
        if (content) {
          passThrough.write(content)
        }
      })

      response.on('end', () => {
        passThrough.end()

        // Log interaction (non-blocking)
        logInteractionToVectorDB({
          question: message,
          answer: 'STREAMING_RESPONSE', // We'll update this later if needed
          moduleId: moduleId || 'global',
          stepId: currentStep?.id,
          userId,
          videoTime
        }).catch(err => console.warn('Failed to log streaming interaction:', err))
      })

      response.on('error', (error) => {
        passThrough.emit('error', error)
      })

      return passThrough
    }
  },

  async generateEnhancedResponse(message: string, similarInteraction: any, context: any): Promise<string> {
    // For enhanced responses, just return the similar answer without extra messaging
    console.log(`♻️ [Enhanced Response] Using similar answer (similarity: ${(similarInteraction.similarity * 100).toFixed(1)}%)`)
    return similarInteraction.answer
  },

  async generateFreshResponse(message: string, context: any): Promise<string> {
    if (!openai) {
      return `I understand you're asking about "${message}".`
    }

    try {
      const prompt = `You are an AI training assistant. Respond helpfully to: "${message}"

      Context:
      - Module: ${context?.moduleId || 'Unknown'}
      - Current step: ${context?.currentStep?.title || 'None'}
      - Video time: ${context?.videoTime || 0}s

      Provide a helpful, informative response. Keep it concise and focused on the user's question.`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150, // Reduced for conciseness
        temperature: 0.3  // More consistent responses
      })

      const freshAnswer = completion.choices[0]?.message?.content ||
        `I understand you're asking about "${message}".`

      console.log(`🆕 [Fresh Response] Generated concise answer`)

      return freshAnswer
    } catch (error) {
      console.warn('⚠️ [Fresh Response] Failed to generate:', error)
      return `I understand you're asking about "${message}".`
    }
  },

  async generateContextualResponse(message: string, context: any): Promise<string> {
    if (!openai) {
      return this.generateBasicContextualResponse(message, context)
    }

    try {
      const { currentStep, allSteps, videoTime, moduleId } = context || {}

      const stepsContext = allSteps?.slice(0, 5).map((step: any, i: number) =>
        `${i + 1}. ${step.title} (${step.start}s - ${step.end}s)`
      ).join('\n') || 'No steps available'

      const prompt = `You are an AI assistant helping with a training video.

      USER QUESTION: "${message}"

      CURRENT CONTEXT:
      - Current step: ${currentStep?.title || 'None'}
      - Step description: ${currentStep?.description || 'N/A'}
      - Video time: ${videoTime || 0} seconds
      - Module ID: ${moduleId || 'Unknown'}

      AVAILABLE STEPS:
      ${stepsContext}

      Provide a helpful, contextual response that relates to the current training content. Be specific about steps, timing, and actions when relevant. Keep responses concise but informative.`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.3
      })

      const rawAnswer = completion.choices[0]?.message?.content ||
        `I can help you with questions about this training. You're currently ${currentStep ? `on step: ${currentStep.title}` : 'navigating the training'}.`

      const contextualAnswer = sanitizeAssistantResponse(rawAnswer)

      console.log(`🎯 [Contextual Response] Generated and sanitized contextual answer`)

      return contextualAnswer
    } catch (error) {
      console.warn('⚠️ [Contextual Response] Failed to generate, using basic response:', error)
      return this.generateBasicContextualResponse(message, context)
    }
  },

  generateBasicContextualResponse(message: string, context: any): string {
    const { currentStep, allSteps } = context || {}

    // Basic pattern matching for common questions
    const msg = message.toLowerCase()

    if (currentStep && (msg.includes('current') || msg.includes('this step'))) {
      const response = `You're currently on **Step ${currentStep.stepNumber || '?'}: ${currentStep.title}**\n\n${currentStep.description}`
      return sanitizeAssistantResponse(response)
    }

    if (msg.includes('how many steps')) {
      const response = `This training has **${allSteps?.length || 0} steps** total.`
      return sanitizeAssistantResponse(response)
    }

    if (msg.includes('what step') && msg.match(/step\s+(\d+)/)) {
      const stepNum = parseInt(msg.match(/step\s+(\d+)/)![1])
      if (allSteps && stepNum <= allSteps.length) {
        const step = allSteps[stepNum - 1]
        const response = `**Step ${stepNum}: ${step.title}**\n\n${step.description}`
        return sanitizeAssistantResponse(response)
      }
    }

    const response = `I'm here to help with your training questions. You can ask me about the current step, specific steps by number, or general questions about the training content.`
    return sanitizeAssistantResponse(response)
  }
}

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
      const moduleData = await ModuleService.getModuleById(moduleId)
      if (!moduleData.success || !moduleData.module) {
        throw new Error(`Module ${moduleId} does not exist in database`)
      }
      console.log(`✅ Module verified in database: ${moduleId}`)

      // Get s3Key from module
      const module = await prisma.module.findUnique({ where: { id: moduleId } })
      if (!module?.s3Key) {
        throw new Error(`Module ${moduleId} missing s3Key`)
      }

      // Use the new pipeline
      const { runPipeline } = await import('./ai/aiPipeline.js')
      await runPipeline(moduleId, module.s3Key)
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
  async generateContextualResponse(message: string, context: any): Promise<string> {
    try {
      const rawResponse = await enhancedAiService.processor.generateContextualResponse(message, context)
      return sanitizeAssistantResponse(rawResponse)
    } catch (error) {
      console.error('❌ Contextual response error:', error)
      throw new Error('Contextual response failed')
    }
  },

  /**
   * Generate streaming contextual response
   */
  async generateStreamingContextualResponse(message: string, context: any): Promise<any> {
    try {
      return await enhancedAiService.processor.generateStreamingContextualResponse(message, context)
    } catch (error) {
      console.error('❌ Streaming contextual response error:', error)
      throw new Error('Streaming response failed')
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
  },

  /**
   * Get AI learning statistics and metrics
   */
  async getLearningStats(): Promise<any> {
    try {
      const { getLearningStats } = await import('./qaRecall.js')
      const stats = await getLearningStats()

      // Get additional metrics
      const totalQuestions = await prisma.question.count()
      const totalModules = await prisma.module.count({ where: { status: 'READY' } })

      return {
        ...stats,
        totalQuestions,
        totalModules,
        knowledgeBaseSize: totalQuestions,
        learningEfficiency: stats.reuseRate > 0 ? Math.round((stats.reuseRate / 100) * 100) / 100 : 0
      }
    } catch (error) {
      console.error('❌ Failed to get learning stats:', error)
      return {
        totalInteractions: 0,
        reusedCount: 0,
        reuseRate: 0,
        totalQuestions: 0,
        totalModules: 0,
        knowledgeBaseSize: 0,
        learningEfficiency: 0,
        recentActivity: []
      }
    }
  }
}

// Re-export types for convenience
export type { Step } from './ai/types.js'