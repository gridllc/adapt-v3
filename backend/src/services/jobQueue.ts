import Bull from 'bull'
import { aiService } from './aiService.js'
import { updateTrainingData, updateStepsData } from './createBasicSteps.js'

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 0,
  retryDelayOnFailover: 0
}

// Check if Redis is available
function checkRedisConnectionSync() {
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('⚠️ Redis disabled via DISABLE_REDIS environment variable')
    return false
  }
  // For now, assume Redis is not available in development
  console.log('⚠️ Redis not available, using mock queue')
  return false
}

// Initialize job queue
let jobQueue: Bull.Queue | any
let useMockQueue = false

function initializeJobQueueSync() {
  try {
    const redisAvailable = checkRedisConnectionSync()

    if (redisAvailable) {
      jobQueue = new Bull('video-processing', {
        redis: redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      })
      jobQueue.on('error', (error: Error) => {
        console.error('❌ Job queue error:', error)
      })
      jobQueue.on('failed', (job: Bull.Job, err: Error) => {
        console.error(`❌ Job ${job.id} failed:`, err)
      })
      console.log('✅ Job queue initialized with Redis')
    } else {
      throw new Error('Redis not available')
    }
  } catch (error) {
    console.log('⚠️ Using mock job queue - Redis not available')
    useMockQueue = true
    jobQueue = {
      add: async (name: string, data: any) => {
        console.log(`📝 [MOCK] Adding job: ${name}`)
        if (name === 'process-video') {
          setTimeout(() => processVideoJob(data), 100)
        }
        return { id: 'mock-job-id' }
      },
      process: (name: string, handler: any) => {
        console.log(`📝 [MOCK] Registered processor for: ${name}`)
      }
    }
  }
}

initializeJobQueueSync()

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

  logGPTComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric && metric.stepsEnd) {
      metric.gptEnd = Date.now()
      const duration = metric.gptEnd - metric.stepsEnd
      console.log(`✨ [${moduleId}] GPT enhancement complete: ${duration}ms`)
    }
  }

  logTotalComplete(moduleId: string) {
    const metric = this.metrics.get(moduleId)
    if (metric) {
      metric.totalEnd = Date.now()
      const totalDuration = metric.totalEnd - metric.uploadStart
      const aiDuration = metric.aiStart ? metric.totalEnd - metric.aiStart : 0
      
      console.log(`🎯 [${moduleId}] TOTAL COMPLETE: ${totalDuration}ms`)
      console.log(`    Upload: ${(metric.uploadEnd - metric.uploadStart)}ms`)
      console.log(`    AI Processing: ${aiDuration}ms`)
      
      // Clean up
      this.metrics.delete(moduleId)
    }
  }
}

export const perfLogger = new PerformanceLogger()

// Extract job processing logic for reuse
async function processVideoJob(jobData: any) {
  const { moduleId, videoUrl } = jobData
  
  try {
    console.log(`🎬 [${moduleId}] Starting async video processing...`)
    
    // Update progress: starting AI processing
    await updateTrainingData(moduleId, { 
      status: 'processing', 
      progress: 10,
      message: 'Starting AI analysis...'
    })

    perfLogger.logAIStart(moduleId)

    // Step 1: AI processing
    console.log(`🧠 [${moduleId}] Starting AI processing...`)
    const moduleData = await aiService.processVideo(videoUrl)
    
    await updateTrainingData(moduleId, { 
      progress: 30,
      message: 'AI analysis complete, extracting steps...'
    })

    perfLogger.logTranscriptionComplete(moduleId)

    // Step 2: Generate steps
    console.log(`📋 [${moduleId}] Generating steps...`)
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    await updateTrainingData(moduleId, { 
      progress: 60,
      message: 'Steps extracted, enhancing with AI...'
    })

    perfLogger.logStepsComplete(moduleId)

    // Step 3: Save final results
    console.log(`💾 [${moduleId}] Saving final results...`)
    await updateStepsData(moduleId, steps)
    
    await updateTrainingData(moduleId, { 
      status: 'ready',
      progress: 100,
      message: 'Processing complete! Your training module is ready.',
      steps: steps
    })

    perfLogger.logGPTComplete(moduleId)
    perfLogger.logTotalComplete(moduleId)
    
    console.log(`✅ [${moduleId}] Processing complete!`)
    
  } catch (error) {
    console.error(`❌ [${moduleId}] Processing failed:`, error)
    
    // Update status to failed
    try {
      await updateTrainingData(moduleId, {
        status: 'failed',
        message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        progress: 0
      })
    } catch (updateError) {
      console.error(`❌ [${moduleId}] Failed to update status to failed:`, updateError)
    }
    
    throw error
  }
}

// Register job processor
if (jobQueue && typeof jobQueue.process === 'function') {
  jobQueue.process('process-video', processVideoJob)
} else {
  console.log('⚠️ Job queue not properly initialized, using mock processing')
}

export { jobQueue } 