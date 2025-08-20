import { ModuleService } from '../moduleService.js'
import { aiService } from '../aiService.js'
import { runOneAtATime } from './queue.js'

export async function startProcessing(moduleId: string) {
  // Use the queue to ensure only one job runs at a time
  return runOneAtATime(async () => {
    // Mark as processing
    await ModuleService.markProcessing(moduleId)
    
    try {
      // Real AI processing: transcribe video and generate steps
      const transcript = await aiService.transcribe(moduleId)
      const steps = await aiService.generateSteps(moduleId, transcript)
      
      // Save the generated steps
      await ModuleService.saveSteps(moduleId, steps)
      
      // Mark as ready with the generated steps
      await ModuleService.markReady(moduleId)
      
      console.log(`✅ AI processing completed for module ${moduleId}`)
      
    } catch (e: any) {
      const msg = String(e?.message || e)
      console.error('processing failed', msg)
      await ModuleService.markError(moduleId, msg)
    }
  })
}
