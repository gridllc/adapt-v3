import { ModuleService } from '../moduleService.js'
import { aiService } from '../aiService.js'

export async function startProcessing(moduleId: string) {
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
    console.error('processing failed', e)
    await ModuleService.markError(moduleId, e?.message || 'processing failed')
  }
}
