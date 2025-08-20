import prisma, { DatabaseService } from '../prismaService.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { videoDownloader } from './videoDownloader.js'
import { transcribeAudio } from './transcriber.js'
import { generateVideoSteps } from './stepGenerator.js'
import { stepSaver } from './stepSaver.js'
import { extractKeyFrames } from './keyFrameExtractor.js'
import { audioProcessor } from './audioProcessor.js'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos';

export async function startProcessing(moduleId: string) {
  console.log(`⚙️ [PIPELINE] Starting processing for moduleId=${moduleId}`)
  
  let localVideoPath: string | null = null
  let localAudioPath: string | null = null
  
  try {
    // --- STEP 1: Update DB to PROCESSING
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 10)
    
    // --- STEP 2: Get module info and S3 key
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { s3Key: true, videoUrl: true }
    })
    
    if (!module) {
      throw new Error(`Module ${moduleId} not found`)
    }
    
    const s3Key = module.s3Key || module.videoUrl
    if (!s3Key) {
      throw new Error(`No S3 key or video URL found for module ${moduleId}`)
    }
    
    console.log(`📥 [PIPELINE] Downloading video from S3: ${s3Key}`)
    
    // --- STEP 3: Download video from S3 to local temp file
    localVideoPath = await videoDownloader.fromS3(s3Key)
    console.log(`✅ [PIPELINE] Video downloaded to: ${localVideoPath}`)
    
    // --- STEP 4: Get video duration
    const duration = await videoDownloader.getVideoDurationSeconds(localVideoPath)
    console.log(`⏱️ [PIPELINE] Video duration: ${duration}s`)
    
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 25)
    
    // --- STEP 5: Extract audio for transcription
    console.log(`🎵 [PIPELINE] Extracting audio...`)
    localAudioPath = await audioProcessor.extract(localVideoPath)
    console.log(`✅ [PIPELINE] Audio extracted to: ${localAudioPath}`)
    
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 40)
    
    // --- STEP 6: Transcribe audio
    console.log(`🎤 [PIPELINE] Starting transcription...`)
    const transcriptResult = await transcribeAudio(localAudioPath, moduleId)
    console.log(`✅ [PIPELINE] Transcription complete: ${transcriptResult.text.length} characters`)
    
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 60)
    
    // --- STEP 7: Extract key frames for visual analysis
    console.log(`🖼️ [PIPELINE] Extracting key frames...`)
    const keyFrames = await extractKeyFrames(localVideoPath, duration, 10, moduleId)
    console.log(`✅ [PIPELINE] Extracted ${keyFrames.length} key frames`)
    
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 75)
    
    // --- STEP 8: Generate AI steps using transcript and metadata
    console.log(`🤖 [PIPELINE] Generating AI steps...`)
    const videoAnalysis = await generateVideoSteps(
      transcriptResult.text,
      transcriptResult.segments || [],
      { duration },
      moduleId
    )
    console.log(`✅ [PIPELINE] Generated ${videoAnalysis.steps.length} steps`)
    
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 90)
    
    // --- STEP 9: Save steps to S3
    console.log(`💾 [PIPELINE] Saving steps to S3...`)
    const stepsKey = `training/${moduleId}.json`
    await stepSaver.saveStepsToS3({
      moduleId,
      s3Key: stepsKey,
      steps: videoAnalysis.steps,
      transcript: transcriptResult.text,
      meta: { duration, keyFrameCount: keyFrames.length }
    })
    console.log(`✅ [PIPELINE] Steps saved to S3: ${stepsKey}`)
    
    // --- STEP 10: Update module to READY
    await prisma.module.update({
      where: { id: moduleId },
      data: {
        stepsKey,
        status: 'READY',
        progress: 100,
      },
    })
    
    console.log(`✅ [PIPELINE] Module ${moduleId} marked READY with AI-generated steps`)
    
  } catch (err) {
    console.error(`❌ [PIPELINE] Error processing module ${moduleId}:`, err)
    
    // Ensure FAILED status if error
    await DatabaseService.updateModuleStatus(moduleId, 'FAILED', 0)
    
    // Re-throw for logging
    throw err
  } finally {
    // --- CLEANUP: Remove temporary files
    try {
      if (localVideoPath) {
        await fs.unlink(localVideoPath)
        console.log(`🧹 [PIPELINE] Cleaned up video: ${localVideoPath}`)
      }
      if (localAudioPath) {
        await fs.unlink(localAudioPath)
        console.log(`🧹 [PIPELINE] Cleaned up audio: ${localAudioPath}`)
      }
    } catch (cleanupError) {
      console.warn(`⚠️ [PIPELINE] Cleanup warning:`, cleanupError)
    }
  }
}
