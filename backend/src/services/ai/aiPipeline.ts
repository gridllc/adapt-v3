import { downloadVideoFromUrl } from './videoDownloader.js'
import { extractAudioFromVideo, getVideoMetadata, truncateVideo } from './audioProcessor.js'
import { transcribeAudio, TranscriptionResult } from './transcriber.js'
import { generateVideoSteps } from './stepGenerator.js'
import { VideoAnalysisResult, Step } from './types.js'
import { saveVideoAnalysis, cleanupTempFiles } from './stepSaver.js'
import { extractKeyFrames, cleanupKeyFrames } from './keyFrameExtractor.js'
import { ModuleService } from '../moduleService.js'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Development video length limit (90 seconds)
const DEV_VIDEO_LIMIT_SECONDS = 90

export interface VideoProcessingResult {
  title: string
  description: string
  transcript: string
  segments: Array<{ start: number; end: number; text: string }>
  steps: Step[]
  totalDuration: number
}

/**
 * Main video processing pipeline that orchestrates all AI services
 */
export async function generateStepsFromVideo(videoUrl: string, moduleId?: string): Promise<VideoProcessingResult> {
  const tempDir = path.resolve('temp')
  const videoId = uuidv4()
  const videoPath = path.join(tempDir, `${videoId}.mp4`)
  const audioPath = path.join(tempDir, `${videoId}.wav`)

  try {
    console.log('🧠 [AIPipeline] Starting video processing for:', videoUrl)
    console.log('🧠 [AIPipeline] Temp video path:', videoPath)
    console.log('🧠 [AIPipeline] Temp audio path:', audioPath)

    // 1. Download video if it's a URL, or use local path
    let actualVideoPath: string
    let currentAudioPath: string
    
    if (videoUrl.startsWith('http')) {
      console.log('📥 [AIPipeline] Downloading video from URL...')
      if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 10, 'Downloading video...')
             actualVideoPath = await downloadVideoFromUrl(videoUrl, moduleId)
      console.log('✅ [AIPipeline] Video downloaded successfully')
    } else {
      // For local files, use the provided path directly
      console.log('📁 [AIPipeline] Using local video file:', videoUrl)
      actualVideoPath = videoUrl
    }

    currentAudioPath = audioPath

    // 2. Extract audio
    console.log('🎵 [AIPipeline] Extracting audio from video...')
    if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 20, 'Extracting audio...')
    await extractAudioFromVideo(actualVideoPath)
    console.log('✅ [AIPipeline] Audio extracted successfully')

    // 3. Get video metadata
    console.log('📊 [AIPipeline] Extracting video metadata...')
    if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 25, 'Analyzing video metadata...')
         const metadata = await getVideoMetadata(actualVideoPath, moduleId)
    console.log('✅ [AIPipeline] Metadata extracted:', metadata)

    // 3.5. Check development video length limit
    if (metadata.duration > DEV_VIDEO_LIMIT_SECONDS) {
      console.log(`⚠️ [AIPipeline] Video is ${metadata.duration}s long, limiting to ${DEV_VIDEO_LIMIT_SECONDS}s for development`)
      console.log(`💡 [AIPipeline] For production, increase DEV_VIDEO_LIMIT_SECONDS or remove this check`)
      
      // Truncate video to 90 seconds for development
      const truncatedPath = path.join(tempDir, `${videoId}_truncated.mp4`)
             await truncateVideo(actualVideoPath, truncatedPath, DEV_VIDEO_LIMIT_SECONDS, moduleId)
      
      // Update paths to use truncated video
      actualVideoPath = truncatedPath
      currentAudioPath = path.join(tempDir, `${videoId}_truncated.wav`)
      
      // Re-extract audio from truncated video
             await extractAudioFromVideo(actualVideoPath, moduleId)
      console.log('🎵 [AIPipeline] Audio re-extracted from truncated video')
      
      // Update metadata
      metadata.duration = DEV_VIDEO_LIMIT_SECONDS
    }

    // 4. Transcribe audio - CRITICAL STEP
    console.log('📝 [AIPipeline] Starting audio transcription...')
    if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 30, 'Transcribing audio...')
         const transcriptionResult = await transcribeAudio(currentAudioPath, moduleId)
    
    // CRITICAL VALIDATION: Check if transcription returned valid result
    if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
      throw new Error('Transcription returned empty result - this is likely a silent failure in Whisper or FFmpeg')
    }
    
    console.log('✅ [AIPipeline] Audio transcribed successfully')
    console.log('📝 [AIPipeline] Transcript length:', transcriptionResult.text.length, 'characters')
    console.log('📝 [AIPipeline] Transcript preview:', transcriptionResult.text.substring(0, 200))
    console.log('📝 [AIPipeline] Segments count:', transcriptionResult.segments.length)

    // 5. Extract key frames
    console.log('🖼️ [AIPipeline] Extracting key frames...')
    if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 40, 'Extracting key frames...')
         const keyFrames = await extractKeyFrames(actualVideoPath, metadata.duration, 10, moduleId)
    console.log('✅ [AIPipeline] Key frames extracted:', keyFrames.length, 'frames')

    // 6. Analyze with AI - CRITICAL STEP
    console.log('🤖 [AIPipeline] Starting AI content analysis...')
    if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 50, 'Analyzing content with AI...')
         const aiResult = await generateVideoSteps(
       transcriptionResult.text, 
       transcriptionResult.segments, 
       metadata,
       moduleId
     )
    
    // CRITICAL VALIDATION: Check if AI analysis returned valid result
    if (!aiResult || !aiResult.steps || !Array.isArray(aiResult.steps)) {
      throw new Error('AI analysis returned invalid result structure - this indicates a silent failure in OpenAI/Gemini API')
    }
    
    if (aiResult.steps.length === 0) {
      throw new Error('AI analysis returned empty steps array - this indicates the AI failed to generate steps')
    }
    
    // Construct the final result with all required properties
    const result: VideoProcessingResult = {
      title: aiResult.title,
      description: aiResult.description,
      steps: aiResult.steps,
      totalDuration: aiResult.totalDuration,
      transcript: transcriptionResult.text,
      segments: transcriptionResult.segments
    }
    
    console.log('✅ [AIPipeline] AI analysis completed successfully')
    console.log('🤖 [AIPipeline] Generated steps:', result.steps.length)
    console.log('🤖 [AIPipeline] Steps preview:', result.steps.slice(0, 2).map(s => ({ text: s.text, startTime: s.startTime, endTime: s.endTime })))

    // 6. Save results
    console.log('💾 [AIPipeline] Saving analysis results...')
    if (moduleId) await ModuleService.updateModuleStatus(moduleId, 'processing', 80, 'Saving analysis results...')
         await saveVideoAnalysis(result, 'data', moduleId)
    console.log('✅ [AIPipeline] Results saved successfully')

    // 7. Cleanup
    console.log('🧹 [AIPipeline] Starting cleanup...')
    const filesToCleanup = [
      videoPath, 
      currentAudioPath, 
      actualVideoPath !== videoUrl ? actualVideoPath : null
    ].filter((path): path is string => path !== null)
    
    await cleanupTempFiles(filesToCleanup)
         await cleanupKeyFrames(keyFrames, moduleId)
    console.log('✅ [AIPipeline] Cleanup completed')

    console.log('🎯 [AIPipeline] Video processing completed successfully!')
    return result
  } catch (error) {
    console.error('❌ [AIPipeline] Video processing error:', error instanceof Error ? error.message : 'Unknown error')
    console.error('❌ [AIPipeline] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('❌ [AIPipeline] This error indicates a silent failure in the processing pipeline')
    
    // Cleanup on error
    try {
      const filesToCleanup = [videoPath, audioPath].filter(Boolean)
      await cleanupTempFiles(filesToCleanup)
    } catch (cleanupError) {
      console.error('❌ [AIPipeline] Cleanup on error failed:', cleanupError)
    }
    
    throw error
  }
}
