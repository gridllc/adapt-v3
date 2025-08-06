import { aiService } from './aiService.js'
import { DatabaseService } from './prismaService.js'
import { ModuleService } from './moduleService.js'

// Performance logging
class PerformanceLogger {
  private metrics = new Map<string, any>()

  startUpload(moduleId: string) {
    this.metrics.set(moduleId, { moduleId, uploadStart: Date.now() })
    console.log(`🚀 [${moduleId}] Upload started`)
  }

  logUploadComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric) {
      metric.uploadEnd = Date.now()
      const duration = metric.uploadEnd - metric.uploadStart
      console.log(`📤 [${moduleId}] Upload complete: ${duration}ms`)
    }
  }

  logAIStart(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric) {
      metric.aiStart = Date.now()
      console.log(`🧠 [${moduleId}] AI processing started`)
    }
  }

  logTranscriptionComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric && metric.aiStart) {
      metric.transcriptionEnd = Date.now()
      const duration = metric.transcriptionEnd - metric.aiStart
      console.log(`🎤 [${moduleId}] Transcription complete: ${duration}ms`)
    }
  }

  logStepsComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric && metric.transcriptionEnd) {
      metric.stepsEnd = Date.now()
      const duration = metric.stepsEnd - metric.transcriptionEnd
      console.log(`📋 [${moduleId}] Step extraction complete: ${duration}ms`)
    }
  }

  logStepSaveComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric && metric.stepsEnd) {
      metric.stepSaveEnd = Date.now()
      const duration = metric.stepSaveEnd - metric.stepsEnd
      console.log(`💾 [${moduleId}] Step save complete: ${duration}ms`)
    }
  }

  logTotalComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric) {
      metric.totalEnd = Date.now()
      
      // Guard against missing uploadStart
      if (!metric.uploadStart) {
        console.warn(`⚠️ [${moduleId}] Missing uploadStart time — skipping perf totals`)
        this.metrics.delete(moduleId)
        return
      }
      
      // Defensive duration calculation helper
      const safeDuration = (start?: number, end?: number) =>
        start != null && end != null ? `${end - start}ms` : 'N/A'
      
      // Calculate total and individual stage durations
      const totalDuration = metric.totalEnd - metric.uploadStart
      const uploadDuration = safeDuration(metric.uploadStart, metric.uploadEnd)
      const aiDuration = safeDuration(metric.aiStart, metric.transcriptionEnd)
      const stepsDuration = safeDuration(metric.transcriptionEnd, metric.stepsEnd)
      const saveDuration = safeDuration(metric.stepsEnd, metric.stepSaveEnd)
      
      console.log(`🎯 [${moduleId}] TOTAL COMPLETE: ${totalDuration}ms`)
      console.log(`    Upload: ${uploadDuration}`)
      console.log(`    AI Processing: ${aiDuration}`)
      console.log(`    Step Extraction: ${stepsDuration}`)
      console.log(`    Save to DB: ${saveDuration}`)
      
      // Log any missing stages for debugging
      const missingStages = []
      if (!metric.uploadEnd) missingStages.push('upload')
      if (!metric.aiStart) missingStages.push('ai-start')
      if (!metric.transcriptionEnd) missingStages.push('transcription')
      if (!metric.stepsEnd) missingStages.push('steps')
      if (!metric.stepSaveEnd) missingStages.push('save')
      
      if (missingStages.length > 0) {
        console.warn(`⚠️ [${moduleId}] Missing timing data for: ${missingStages.join(', ')}`)
      }
      
      // Clean up
      this.metrics.delete(moduleId)
    }
  }
}

export const perfLogger = new PerformanceLogger()

// QStash configuration
const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const QSTASH_ENDPOINT = process.env.QSTASH_ENDPOINT || 'https://qstash.upstash.io/v1/publish'
const QSTASH_WORKER_URL = process.env.QSTASH_WORKER_URL

// Log QStash configuration
console.log('🔧 QStash Configuration:')
if (QSTASH_TOKEN && QSTASH_WORKER_URL) {
  console.log(`   QStash Token: ${QSTASH_TOKEN ? 'SET' : 'NOT SET'}`)
  console.log(`   QStash Endpoint: ${QSTASH_ENDPOINT}`)
  console.log(`   Worker URL: ${QSTASH_WORKER_URL}`)
} else {
  console.log(`   QStash: DISABLED - Missing QSTASH_TOKEN or QSTASH_WORKER_URL`)
}

// Fallback rate limiter
let fallbackCount = 0
const FALLBACK_LIMIT = 5

// Enqueue job to QStash with retry logic
export async function enqueueProcessVideoJob({ moduleId, videoUrl }: { moduleId: string; videoUrl: string }) {
  if (!QSTASH_TOKEN || !QSTASH_WORKER_URL) {
    console.warn('⚠️ QStash not configured - falling back to immediate processing')
    
    // Check fallback rate limit
    if (fallbackCount > FALLBACK_LIMIT) {
      console.warn(`⚠️ Too many local fallbacks (${fallbackCount}) — consider fixing QStash`)
    }
    fallbackCount++
    
    // Fallback to immediate processing
    setTimeout(() => processVideoJob({ moduleId, videoUrl }), 100)
    return { id: 'immediate-job-id' }
  }

  // Retry logic for temporary QStash/network errors
  const maxAttempts = 2
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(QSTASH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Forward': QSTASH_WORKER_URL
        },
        body: JSON.stringify({ moduleId, videoUrl })
      })

      if (!response.ok) {
        throw new Error(`QStash request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json() as any
      console.log(`📝 [QStash] Job enqueued for moduleId=${moduleId} (attempt ${attempt + 1})`)
      
      // Reset fallback counter on successful enqueue
      fallbackCount = 0
      
      return { id: result.messageId || 'qstash-job-id' }
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1
      
      if (!isLastAttempt) {
        console.warn(`⚠️ QStash enqueue attempt ${attempt + 1} failed, retrying...`, error)
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        console.error('❌ Failed to enqueue job to QStash after retries:', error)
        
        // Check fallback rate limit
        if (fallbackCount > FALLBACK_LIMIT) {
          console.warn(`⚠️ Too many local fallbacks (${fallbackCount}) — consider fixing QStash`)
        }
        fallbackCount++
        
        // Fallback to immediate processing
        console.log('🔄 Falling back to immediate processing...')
        setTimeout(() => processVideoJob({ moduleId, videoUrl }), 100)
        return { id: 'fallback-job-id' }
      }
    }
  }
}

// Process video job (called by QStash worker)
export async function processVideoJob(jobData: { moduleId: string; videoUrl: string }) {
  const { moduleId, videoUrl } = jobData
  
  console.log(`🧠 Job received for moduleId=${moduleId}, videoUrl=${videoUrl}`)
  
  try {
    console.log(`🎬 [${moduleId}] Starting async video processing...`)
    console.log(`🎬 [${moduleId}] Video URL: ${videoUrl}`)
    
    // Update status to processing
    await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Starting AI processing...')

    perfLogger.logAIStart(moduleId)

    // Step 1: Complete AI processing pipeline
    // Note: generateStepsForModule calls processVideo internally and does additional processing
    // It extracts high-level metadata AND generates final user-visible steps
    console.log(`[TEST] 🤖 Generating AI steps for module: ${moduleId}`)
    console.log(`[TEST] 🎬 Video URL: ${videoUrl}`)
    await ModuleService.updateModuleStatus(moduleId, 'processing', 10, 'Starting AI analysis...')
    
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    if (!steps || !Array.isArray(steps)) {
      throw new Error('Step generation returned invalid result')
    }
    
    console.log(`[TEST] 🧠 AI processing complete - generated ${steps.length} steps`)
    console.log(`📋 [${moduleId}] Generated ${steps.length} steps`)
    
    await ModuleService.updateModuleStatus(moduleId, 'processing', 60, 'Steps extracted, saving to database...')

    perfLogger.logTranscriptionComplete(moduleId)
    perfLogger.logStepsComplete(moduleId)

    await DatabaseService.createSteps(moduleId, steps)

    // Step 3: Save final results
    console.log(`💾 [${moduleId}] Saving final results...`)
    await ModuleService.updateModuleStatus(moduleId, 'processing', 80, 'Saving final results...')
    
    await ModuleService.updateModuleStatus(moduleId, 'ready', 100, 'Processing complete! Your training module is ready.')

    perfLogger.logStepSaveComplete(moduleId)
    perfLogger.logTotalComplete(moduleId)
    
    console.log(`✅ Job complete for moduleId=${moduleId}`)
    
  } catch (error) {
    console.error(`❌ Job failed for moduleId=${moduleId}`, error)
    console.error(`❌ [${moduleId}] Processing failed:`, error)
    console.error(`❌ [${moduleId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    
    // Update status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await ModuleService.updateModuleStatus(moduleId, 'failed', 0, `Processing failed: ${errorMessage}`)
    
    // Ensure performance logging cleanup even on error
    perfLogger.logTotalComplete(moduleId)
    
    throw error
  }
}

// Allow manual testing: `node qstashQueue.js <moduleId> <videoUrl>`
// Only works when run directly, not when imported as a module
if (import.meta.url === `file://${process.argv[1]}`) {
  const [moduleId, videoUrl] = process.argv.slice(2)
  
  if (moduleId && videoUrl) {
    console.log(`🧪 [TEST MODE] Processing video job manually:`)
    console.log(`   Module ID: ${moduleId}`)
    console.log(`   Video URL: ${videoUrl}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)
    
    processVideoJob({ moduleId, videoUrl })
      .then(() => {
        console.log(`✅ [TEST MODE] Manual processing completed successfully`)
        process.exit(0)
      })
      .catch((error) => {
        console.error(`❌ [TEST MODE] Manual processing failed:`, error)
        process.exit(1)
      })
  } else {
    console.log(`🧪 [TEST MODE] QStash Queue Manual Testing`)
    console.log(`Usage: node qstashQueue.js <moduleId> <videoUrl>`)
    console.log(``)
    console.log(`Example:`)
    console.log(`  node qstashQueue.js test-module-123 https://example.com/video.mp4`)
    console.log(``)
    console.log(`This will bypass QStash and process the video job directly.`)
    process.exit(1)
  }
} 