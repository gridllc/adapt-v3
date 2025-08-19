import { ModuleService } from '../moduleService.js'
import { storageService } from '../storageService.js'
import { audioProcessor } from './audioProcessor.js'
import { transcribeAudio } from './transcriber.js'
import { stepSaver } from './stepSaver.js'
import { generateVideoSteps } from './stepGenerator.js'
import { VideoProcessor } from './videoProcessor.js'
import { uploadFileToS3 } from '../s3Uploader.js'
import path from 'path'
import fs from 'fs/promises'

/**
 * Unified entry point (matches qstashQueue import).
 */
export async function startProcessing(moduleId: string, opts?: { force?: boolean }) {
  return generateStepsFromVideo(moduleId, opts)
}

export async function generateStepsFromVideo(moduleId: string, opts?: { force?: boolean }) {
  const mod = await ModuleService.getModuleById(moduleId)
  if (!mod.success || !mod.module) throw new Error(`Module ${moduleId} not found`)

  // Ensure keys exist
  if (!mod.module.s3Key || !mod.module.stepsKey) {
    throw new Error(`Module ${moduleId} missing s3Key/stepsKey`)
  }

  // If already ready and not forcing, bail
  if (!opts?.force && mod.module.status === "READY") return { ok: true, skipped: true }

  // If already processing and not forcing, skip (don't throw)
  if (!opts?.force && mod.module.status === "PROCESSING") {
    console.log(`⏳ [AIPipeline] Module ${moduleId} already PROCESSING; skipping duplicate trigger.`)
    return { ok: true, skipped: true, reason: 'Already processing' }
  }

  // Try to acquire processing lock (atomic status flip)
  console.log(`🔒 [AIPipeline] Attempting to acquire processing lock for module: ${moduleId}`)
  const gotLock = await ModuleService.tryLockForProcessing(moduleId)
  if (!gotLock) {
    console.log(`🔒 [AIPipeline] Processing lock not acquired for module ${moduleId} - another worker is processing`)
    return { ok: true, skipped: true, reason: 'Already being processed' }
  }

  console.log(`🔒 [AIPipeline] Processing lock acquired for module ${moduleId} - starting work`)

  // Declare variables in function scope for cleanup
  let localMp4: string = ''
  let normalizedVideoPath: string = ''
  let wavPath: string = ''

  try {
    // 1) Download MP4 from S3 to temp
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 20, "Downloading video...")
    const { videoDownloader } = await import('./videoDownloader.js')
    localMp4 = await videoDownloader.fromS3(mod.module.s3Key)

    // 1.5) 🚨 NORMALIZE VIDEO for browser compatibility (H.264 + AAC)
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 25, "Normalizing video format...")
    normalizedVideoPath = await VideoProcessor.normalizeVideo(localMp4, `${localMp4}-normalized.mp4`)
    
    // Upload normalized video back to S3 (replaces original)
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 30, "Uploading normalized video...")
    await uploadFileToS3(mod.module.s3Key, normalizedVideoPath, "video/mp4")
    
    // Use normalized video for further processing
    const videoForProcessing = normalizedVideoPath

    // 2) Extract WAV with ffmpeg
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 35, "Converting video to audio...")
    wavPath = await audioProcessor.extract(videoForProcessing)

    // 3) Transcribe via OpenAI API
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 55, "Transcribing audio...")
    const transcript = await transcribeAudio(wavPath, moduleId)

    // 4) Get video duration for proper step timing
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 70, "Getting video duration...")
    const durationSec = await videoDownloader.getVideoDurationSeconds(localMp4)
    console.log(`📹 [AIPipeline] Video duration: ${durationSec}s`)

    // 5) Turn transcript into steps with actual video duration
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 75, "Generating steps...")
    const steps = await generateVideoSteps(
      transcript.text,
      transcript.segments,
      { duration: durationSec }, // Pass actual video duration
      moduleId
    )

    // 6) Save steps JSON to S3 + mark READY
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 85, "Saving steps...")
    
    // Save steps to S3
    await stepSaver.saveStepsToS3({
      moduleId: moduleId,
      s3Key: mod.module.stepsKey,
      steps: steps.steps,
      transcript: transcript.text,
      meta: {
        durationSec,
        stepCount: steps.steps.length,
        segments: transcript.segments
      }
    })

    // Also save steps to database
    await ModuleService.saveStepsToModule(moduleId, steps.steps)

    await ModuleService.markReady(moduleId)
    console.log(`✅ [AIPipeline] Module ${moduleId} processing complete`)
    
    // 🧹 Clean up temporary files
    try {
      await VideoProcessor.cleanupTempFiles([localMp4, normalizedVideoPath, wavPath])
    } catch (cleanupErr) {
      console.warn(`⚠️ [AIPipeline] Cleanup warning for module ${moduleId}:`, cleanupErr)
    }
    
    return { ok: true, moduleId }
  } catch (err: any) {
    console.error(`❌ [AIPipeline] Module ${moduleId} processing failed:`, err)
    
    // CRITICAL FALLBACK: Create basic steps so module isn't stuck
    console.log(`🔄 [AIPipeline] Creating fallback basic steps for module ${moduleId}`)
    try {
      const fallbackSteps = [
        {
          id: 'step-1',
          text: 'Video processing completed - manual step creation needed',
          start: 0,
          end: 60, // Default 60 seconds
          startTime: 0,
          endTime: 60,
          aliases: [],
          notes: 'AI processing failed - please edit this step'
        }
      ]

      // Save basic steps to S3
      await stepSaver.saveStepsToS3({
        moduleId: moduleId,
        s3Key: mod.module.stepsKey,
        steps: fallbackSteps,
        transcript: 'Processing failed - transcript unavailable',
        meta: {
          fallbackCreated: true,
          originalError: String(err?.message ?? err),
          timestamp: new Date().toISOString()
        }
      })

      // Save to database
      await ModuleService.saveStepsToModule(moduleId, fallbackSteps)

      // Mark ready
      await ModuleService.markReady(moduleId)
      console.log(`✅ [AIPipeline] Fallback steps created for module ${moduleId}`)
      
      // 🧹 Clean up temporary files even in fallback case
      try {
        const filesToClean = [localMp4, wavPath]
        if (typeof normalizedVideoPath !== 'undefined') filesToClean.push(normalizedVideoPath)
        await VideoProcessor.cleanupTempFiles(filesToClean)
      } catch (cleanupErr) {
        console.warn(`⚠️ [AIPipeline] Cleanup warning in fallback for module ${moduleId}:`, cleanupErr)
      }
      
      return { ok: true, moduleId, fallback: true }
    } catch (fallbackErr) {
      console.error(`❌ [AIPipeline] Fallback step creation also failed:`, fallbackErr)
      await ModuleService.markFailed(moduleId, String(err?.message ?? err))
      throw err
    }
  }
}
