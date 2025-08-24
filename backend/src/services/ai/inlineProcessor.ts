// backend/src/services/ai/inlineProcessor.ts
// Simplified inline processing pipeline using Whisper (no external webhooks)

import { ModuleService } from '../moduleService.js'
import { aiService } from '../aiService.js'
import { storageService } from '../storageService.js'
import { log } from '../../utils/logger.js'

/**
 * Complete inline processing pipeline - MVP version
 * Uses OpenAI Whisper directly instead of AssemblyAI webhooks
 */
export async function processModuleInline(moduleId: string): Promise<void> {
  const timestamp = new Date().toISOString()
  
  try {
    log.info(`🚀 [INLINE] Starting inline processing`, { moduleId, timestamp })
    
    // Step 1: Get and validate module
    const module = await ModuleService.get(moduleId)
    if (!module || !module.s3Key) {
      throw new Error(`Module ${moduleId} not found or missing s3Key`)
    }
    
    if (module.status === 'READY') {
      log.info(`✅ [INLINE] Module already READY, skipping`, { moduleId })
      return
    }
    
    // Step 2: Update to 30% - Transcribing with Whisper
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 30)
    log.info(`🎙️ [INLINE] Starting Whisper transcription`, { moduleId })
    
    // Step 3: Transcribe using OpenAI Whisper
    let transcriptText: string
    try {
      transcriptText = await aiService.transcribe(moduleId)
      if (!transcriptText || transcriptText.trim().length < 10) {
        throw new Error('Transcript too short or empty')
      }
      log.info(`📝 [INLINE] Transcription completed`, { 
        moduleId, 
        transcriptLength: transcriptText.length,
        preview: transcriptText.substring(0, 100) + '...'
      })
    } catch (transcriptError: any) {
      log.error(`❌ [INLINE] Whisper transcription failed`, { moduleId, error: transcriptError.message })
      throw new Error(`Transcription failed: ${transcriptError.message}`)
    }
    
    // Step 4: Save transcript and update to 60%
    await ModuleService.applyTranscript(moduleId, transcriptText)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 60)
    log.info(`💾 [INLINE] Transcript saved`, { moduleId })
    
    // Step 5: Generate steps with AI
    let steps: any[]
    try {
      log.info(`🤖 [INLINE] Generating steps with AI`, { moduleId })
      steps = await aiService.generateSteps(moduleId, transcriptText)
      
      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        throw new Error('AI generated no steps')
      }
      
      log.info(`🎯 [INLINE] AI steps generated`, { moduleId, stepCount: steps.length })
    } catch (aiError: any) {
      log.warn(`⚠️ [INLINE] AI step generation failed, creating basic steps`, { moduleId, error: aiError.message })
      
      // Create basic fallback steps
      steps = [
        {
          id: 'step-1',
          text: 'Introduction and overview',
          startTime: 0,
          endTime: 30,
          order: 1
        },
        {
          id: 'step-2', 
          text: 'Main content and demonstration',
          startTime: 30,
          endTime: 120,
          order: 2
        },
        {
          id: 'step-3',
          text: 'Summary and conclusion',
          startTime: 120,
          endTime: 180,
          order: 3
        }
      ]
    }
    
    // Step 6: Save steps to S3 and update to 80%
    const stepsKey = `training/${moduleId}.json`
    const stepsData = {
      title: module.title || 'Training Module',
      description: 'Step-by-step guide generated from video',
      steps: steps,
      transcript: transcriptText,
      totalDuration: steps[steps.length - 1]?.endTime || 180,
      generatedAt: timestamp
    }
    
    try {
      await storageService.putObject(stepsKey, JSON.stringify(stepsData), 'application/json')
      await ModuleService.updateStepsKey(moduleId, stepsKey)
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 80)
      log.info(`📂 [INLINE] Steps saved to S3`, { moduleId, stepsKey, stepCount: steps.length })
    } catch (stepsError: any) {
      log.error(`❌ [INLINE] Failed to save steps`, { moduleId, error: stepsError.message })
      throw new Error(`Failed to save steps: ${stepsError.message}`)
    }
    
    // Step 7: Mark as READY (100%)
    await ModuleService.markReady(moduleId)
    log.info(`🎉 [INLINE] Module processing completed`, { moduleId, timestamp })
    
  } catch (error: any) {
    log.error(`💥 [INLINE] Processing failed`, { 
      moduleId, 
      timestamp,
      error: error.message,
      stack: error.stack 
    })
    
    // Mark as failed and preserve error
    try {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 100)
      await ModuleService.markError(moduleId, error.message)
    } catch (persistError: any) {
      log.error(`⚠️ [INLINE] Failed to persist error state`, { 
        moduleId, 
        error: persistError.message 
      })
    }
    
    throw error // Re-throw so caller knows it failed
  }
}
