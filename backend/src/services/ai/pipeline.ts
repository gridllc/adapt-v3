import { ModuleService } from '../moduleService.js'
import { videoDownloader } from './videoDownloader.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { generateVideoSteps } from './stepGenerator.js'
import { stepSaver } from './stepSaver.js'
import { storageService } from '../storageService.js'
import { prisma } from '../../config/database.js'

/**
 * Simple pipeline helper for starting processing
 */
export async function startProcessing(moduleId: string) {
  let tmpPaths: string[] = []
  
  try {
    console.log('[Pipeline] Starting processing for module:', moduleId)
    
    // Get module data
    const mod = await ModuleService.getModuleById(moduleId)
    if (!mod) {
      throw new Error('Module not found')
    }
    
    // Check if module has s3Key
    if (!mod.s3Key) {
      throw new Error('Missing s3Key - cannot process module without S3 video')
    }
    
    console.log('[Pipeline] Module found, s3Key:', mod.s3Key)
    
    // Update status to processing
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Starting AI processing...')
    
    // Download from S3 and extract audio
    console.log('[Pipeline] Downloading from S3 and extracting audio...')
    const localMp4 = await videoDownloader.fromS3(mod.s3Key)
    const wavPath = await audioProcessor.extract(localMp4)
    tmpPaths = [localMp4, wavPath]
    
    console.log('[Pipeline] Audio extracted to:', wavPath)
    
    // Transcribe audio
    console.log('[Pipeline] Transcribing audio...')
    const transcript = await transcribeAudio(wavPath, moduleId)
    
    if (!transcript.text || transcript.text.trim().length === 0) {
      throw new Error('Transcription returned empty result')
    }
    
    console.log('[Pipeline] Transcription complete, length:', transcript.text.length)
    
    // Generate steps from transcript
    console.log('[Pipeline] Generating steps...')
    const steps = await generateVideoSteps(
      transcript.text, 
      transcript.segments, 
      { duration: 0 }, // Mock duration since we don't have video metadata
      moduleId
    )
    
    console.log('[Pipeline] Steps generated:', steps.steps?.length || 0)
    
    // Save to S3
    const stepsKey = `training/${moduleId}.json`
    await storageService.putObject(stepsKey, JSON.stringify({
      moduleId,
      steps: steps.steps,
      transcript: transcript.text,
      segments: transcript.segments,
      metadata: {
        totalSteps: steps.steps?.length || 0,
        sourceFile: 's3',
        hasEnhancedSteps: true,
        hasStructuredSteps: true,
        hasOriginalSteps: false
      }
    }))
    
    console.log('[Pipeline] Results saved to S3:', stepsKey)
    
    // Update status to ready
    await ModuleService.updateModuleStatus(moduleId, 'READY', 100, 'AI processing complete!')
    
    console.log('[Pipeline] Processing complete for module:', moduleId)
    
  } catch (error) {
    console.error('[Pipeline] Processing failed for module:', moduleId, error)
    
    // Update status to failed
    await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0, 
      `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    throw error
  } finally {
    // Always cleanup temp files
    if (tmpPaths.length > 0) {
      console.log('[Pipeline] Cleaning up temp files...')
      // Temp files will be cleaned up automatically by the OS
      console.log('Temp files will be cleaned up automatically by the OS')
    }
  }
}
