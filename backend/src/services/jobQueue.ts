import Bull from 'bull'
import { aiService } from './aiService.js'
import { updateTrainingData, updateStepsData } from './createBasicSteps.js'
import { saveModuleStatus, updateModuleProgress } from './statusService.js'
import { testRedisConnection } from './redisClient.js'

// Redis configuration for Bull (Railway)
const redisConfig = {
  host: process.env.REDIS_HOST, // e.g. metro.proxy.rlwy.net
  port: Number(process.env.REDIS_PORT), // e.g. 40569
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
}

// Check if Redis is available
async function checkRedisConnection() {
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('⚠️ Redis disabled via DISABLE_REDIS environment variable')
    return false
  }
  
  try {
    const isConnected = await testRedisConnection()
    if (isConnected) {
      console.log('✅ Redis connection successful, using real queue')
      return true
    } else {
      console.log('⚠️ Redis connection failed, using mock queue')
      return false
    }
  } catch (error) {
    console.log('⚠️ Redis not available, using mock queue:', error)
    return false
  }
}

// Initialize job queue
let jobQueue: Bull.Queue | any
let useMockQueue = false

async function initializeJobQueue() {
  try {
    const redisAvailable = await checkRedisConnection()

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
      
      // Enhanced error logging
      jobQueue.on('error', (error: Error) => {
        console.error('❌ Job queue error:', error)
        console.error('   ↳ Stack:', error.stack)
      })
      
      jobQueue.on('active', (job: Bull.Job) => {
        console.log(`📥 Job started: ${job.id} (moduleId=${job.data?.moduleId})`)
      })
      
      jobQueue.on('completed', (job: Bull.Job, result: any) => {
        console.log(`✅ Job completed: ${job.id} (moduleId=${job.data?.moduleId})`)
        console.log(`   ↳ Result:`, result)
      })
      
      jobQueue.on('failed', (job: Bull.Job, err: Error) => {
        console.error(`❌ Job failed: ${job.id} (moduleId=${job.data?.moduleId})`)
        console.error('   ↳ Error:', err.message)
        console.error('   ↳ Stack:', err.stack)
        console.error('   ↳ Job data:', job.data)
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
        console.log(`📝 [MOCK] Job data:`, data)
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

// Initialize job queue asynchronously
initializeJobQueue().catch(error => {
  console.error('❌ Failed to initialize job queue:', error)
  // Fall back to mock queue
  useMockQueue = true
  jobQueue = {
    add: async (name: string, data: any) => {
      console.log(`📝 [MOCK] Adding job: ${name}`)
      console.log(`📝 [MOCK] Job data:`, data)
      if (name === 'process-video') {
        setTimeout(() => processVideoJob(data), 100)
      }
      return { id: 'mock-job-id' }
    },
    process: (name: string, handler: any) => {
      console.log(`📝 [MOCK] Registered processor for: ${name}`)
    }
  }
})

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
  
  console.log(`🧠 Job received for moduleId=${moduleId}, videoUrl=${videoUrl}`)
  
  try {
    console.log(`🎬 [${moduleId}] Starting async video processing...`)
    console.log(`🎬 [${moduleId}] Video URL: ${videoUrl}`)
    
    // Update status to processing
    await saveModuleStatus(moduleId, 'processing', 'Starting AI processing...', 0)
    
    // Update progress: starting AI processing
    await updateTrainingData(moduleId, { 
      status: 'processing', 
      progress: 10,
      message: 'Starting AI analysis...'
    })

    perfLogger.logAIStart(moduleId)

    // Step 1: AI processing
    console.log(`🧠 [${moduleId}] Starting AI processing...`)
    await updateModuleProgress(moduleId, 10, 'Starting AI analysis...')
    
    const moduleData = await aiService.processVideo(videoUrl)
    
    if (!moduleData) {
      throw new Error('AI processing returned null/undefined result')
    }
    
    console.log(`🧠 [${moduleId}] AI processing completed successfully`)
    console.log(`🧠 [${moduleId}] Result:`, moduleData)
    
    await updateModuleProgress(moduleId, 30, 'AI analysis complete, extracting steps...')
    await updateTrainingData(moduleId, { 
      progress: 30,
      message: 'AI analysis complete, extracting steps...'
    })

    perfLogger.logTranscriptionComplete(moduleId)

    // Step 2: Generate steps
    console.log(`📋 [${moduleId}] Generating steps...`)
    await updateModuleProgress(moduleId, 50, 'Generating steps...')
    
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    if (!steps || !Array.isArray(steps)) {
      throw new Error('Step generation returned invalid result')
    }
    
    console.log(`📋 [${moduleId}] Generated ${steps.length} steps`)
    
    await updateModuleProgress(moduleId, 60, 'Steps extracted, enhancing with AI...')
    await updateTrainingData(moduleId, { 
      progress: 60,
      message: 'Steps extracted, enhancing with AI...'
    })

    perfLogger.logStepsComplete(moduleId)

    // Step 3: Save final results
    console.log(`💾 [${moduleId}] Saving final results...`)
    await updateModuleProgress(moduleId, 80, 'Saving final results...')
    
    await updateStepsData(moduleId, steps)
    
    await updateModuleProgress(moduleId, 100, 'Processing complete! Your training module is ready.')
    await updateTrainingData(moduleId, { 
      status: 'ready',
      progress: 100,
      message: 'Processing complete! Your training module is ready.',
      steps: steps
    })

    // Mark as complete
    await saveModuleStatus(moduleId, 'complete', 'Processing complete!', 100)

    perfLogger.logGPTComplete(moduleId)
    perfLogger.logTotalComplete(moduleId)
    
    console.log(`✅ Job complete for moduleId=${moduleId}`)
    
  } catch (error) {
    console.error(`❌ Job failed for moduleId=${moduleId}`, error)
    console.error(`❌ [${moduleId}] Processing failed:`, error)
    console.error(`❌ [${moduleId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    
    // Update status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await saveModuleStatus(moduleId, 'error', `Processing failed: ${errorMessage}`, 0, errorMessage)
    
    try {
      await updateTrainingData(moduleId, {
        status: 'failed',
        message: `Processing failed: ${errorMessage}`,
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