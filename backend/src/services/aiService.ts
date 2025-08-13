import { generateStepsFromVideo, VideoProcessingResult } from './ai/aiPipeline.js'
import { ModuleService } from './moduleService.js'
import { enhancedAiService } from './enhancedVideoProcessor.js'
import { rewriteStepsWithGPT } from '../utils/transcriptFormatter.js'

export const aiService = {
  /**
   * Full pipeline to generate steps from a video and save them to the module.
   * @param moduleId - ID of the module in DB
   * @param videoKey - S3 key (e.g., "videos/abc.mp4") or full URL for backward compatibility
   */
  async generateStepsForModule(moduleId: string, videoKey: string): Promise<VideoProcessingResult> {
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
      
      await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Starting AI analysis...')
      const result = await generateStepsFromVideo(videoKey, moduleId)
      await ModuleService.saveStepsToModule(moduleId, result.steps)
      await ModuleService.updateModuleStatus(moduleId, 'ready', 100, 'AI processing complete!')
      return result
    } catch (err) {
      await ModuleService.updateModuleStatus(moduleId, 'failed', 0, 'AI processing failed')
      throw new Error(`Step generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  /**
   * Process video without module context (for testing/development)
   */
  async processVideo(videoKey: string): Promise<VideoProcessingResult> {
    return await generateStepsFromVideo(videoKey)
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
      return enhancedAiService.processor.generateContextualResponse(message, context)
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
  }
}

// Re-export types for convenience
export type { VideoProcessingResult } from './ai/aiPipeline.js'
export type { Step } from './ai/types.js'
export type { TranscriptionResult } from './ai/transcriber.js'