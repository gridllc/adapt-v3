import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { extractAudioWavForModule, cleanupTemp } from './audioProcessor.js'
import { generateVideoSteps } from './stepGenerator.js'
import { transcribeAudio } from './transcriber.js'
import { prisma } from '../../config/database.js'

// Loud log to confirm this file is being used
console.log('[AIPipeline] Using S3-first pipeline:', __filename)

export interface VideoProcessingResult {
  title: string
  description: string
  transcript: string
  segments: Array<{ start: number; end: number; text: string }>
  steps: any[]
  totalDuration: number
}

/**
 * Main video processing pipeline that orchestrates all AI services
 * Now S3-first: always downloads from S3 to /app/temp
 */
export async function generateStepsFromVideo(videoUrl: string, moduleId?: string): Promise<VideoProcessingResult> {
  let tmpPaths: string[] = []
  
  try {
    if (!moduleId) {
      throw new Error('Module ID is required for S3-first processing')
    }

    console.log('🧠 [AIPipeline] Starting S3-first video processing for module:', moduleId)
    
    // 1. Extract audio from S3 - this downloads the video and extracts audio
    console.log('🎵 [AIPipeline] Extracting audio from S3...')
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 20, 'Extracting audio from S3...')
    
    const { wavPath, tmpPaths: audioTmpPaths } = await extractAudioWavForModule(moduleId)
    tmpPaths = audioTmpPaths
    
    console.log('✅ [AIPipeline] Audio extracted successfully from S3 to:', wavPath)

    // 2. Transcribe audio - CRITICAL STEP
    console.log('📝 [AIPipeline] Starting audio transcription...')
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 30, 'Transcribing audio...')
    
    const transcriptionResult = await transcribeAudio(wavPath, moduleId)
    
    // CRITICAL VALIDATION: Check if transcription returned valid result
    if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
      throw new Error('Transcription returned empty result - this is likely a silent failure in Whisper or FFmpeg')
    }
    
    console.log('✅ [AIPipeline] Transcription completed, text length:', transcriptionResult.text.length)

    // 3. Generate steps from transcript
    console.log('🤖 [AIPipeline] Generating steps from transcript...')
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 50, 'Generating steps from transcript...')
    
    const aiResult = await generateVideoSteps(
      transcriptionResult.text, 
      transcriptionResult.segments, 
      { duration: 0 }, // Mock duration since we don't have video metadata
      moduleId
    )
    
    console.log('✅ [AIPipeline] Steps generated:', aiResult.steps?.length || 0, 'steps')

    // 4. Save results to S3
    console.log('💾 [AIPipeline] Saving results to S3...')
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 80, 'Saving results to S3...')
    
    // Get the module to find stepsKey
    const mod = await prisma.module.findUnique({ 
      where: { id: moduleId }, 
      select: { id: true, title: true, filename: true, videoUrl: true, status: true, progress: true, userId: true, createdAt: true, updatedAt: true }
    })
    const stepsKey = `training/${moduleId}.json` // Use default key since stepsKey might not exist
    
    // Save to S3 JSON (canonical)
    await storageService.putJson(stepsKey, { 
      moduleId, 
      steps: aiResult.steps,
      transcript: transcriptionResult.text,
      segments: transcriptionResult.segments,
      metadata: {
        totalSteps: aiResult.steps?.length || 0,
        sourceFile: 's3',
        hasEnhancedSteps: true,
        hasStructuredSteps: true,
        hasOriginalSteps: false
      }
    })
    
    console.log('✅ [AIPipeline] Results saved to S3:', stepsKey)

    // 5. Mark module as ready
    await ModuleService.updateModuleStatus(moduleId, 'READY', 100, 'AI processing complete!')
    
    // Return the result
    return {
      title: aiResult.title || 'Untitled Training Module',
      description: aiResult.description || 'AI-generated training steps',
      transcript: transcriptionResult.text,
      segments: transcriptionResult.segments || [],
      steps: aiResult.steps || [],
      totalDuration: aiResult.totalDuration || 0
    }

  } catch (error) {
    console.error('❌ [AIPipeline] Processing failed:', error)
    
    if (moduleId) {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0, 
        `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    throw error
  } finally {
    // Always cleanup temp files
    if (tmpPaths.length > 0) {
      console.log('🧹 [AIPipeline] Cleaning up temp files...')
      await cleanupTemp(tmpPaths)
    }
  }
}
