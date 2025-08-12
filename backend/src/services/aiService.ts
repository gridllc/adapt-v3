import { generateStepsFromVideo, VideoProcessingResult } from './ai/aiPipeline.js'
import { ModuleService } from './moduleService.js'

export const aiService = {
  /**
   * Full pipeline to generate steps from a video and save them to the module.
   * @param moduleId - ID of the module in DB
   * @param videoUrl - Signed/public S3 video URL
   */
  async generateStepsForModule(moduleId: string, videoUrl: string): Promise<VideoProcessingResult> {
    console.log(`🤖 [AI Service] Starting step generation for module: ${moduleId}`)

    try {
      // Update module status to processing
      await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Starting AI analysis...')
      
      // Run the full AI pipeline
      const result = await generateStepsFromVideo(videoUrl, moduleId)
      
      // Save steps to module in DB
      await ModuleService.saveStepsToModule(moduleId, result.steps)
      
      // Update module status to ready
      await ModuleService.updateModuleStatus(moduleId, 'ready', 100, 'AI processing complete!')
      
      console.log(`✅ [AI Service] Successfully generated ${result.steps.length} steps for module ${moduleId}`)
      return result
      
    } catch (err) {
      console.error(`❌ [AI Service] Failed to generate steps for module ${moduleId}:`, err)
      
      // Update module status to failed
      try {
        await ModuleService.updateModuleStatus(moduleId, 'failed', 0, 'AI processing failed')
      } catch (statusError) {
        console.error(`❌ [AI Service] Failed to update module status to failed:`, statusError)
      }
      
      throw new Error(`Step generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  },

  /**
   * Process video without saving to module (for testing/debugging)
   */
  async processVideo(videoUrl: string): Promise<VideoProcessingResult> {
    console.log(`🤖 [AI Service] Processing video: ${videoUrl}`)
    return await generateStepsFromVideo(videoUrl)
  }
}

// Re-export types for convenience
export type { VideoProcessingResult } from './ai/aiPipeline.js'
export type { Step } from './ai/stepGenerator.js'
export type { TranscriptionResult } from './ai/transcriber.js'