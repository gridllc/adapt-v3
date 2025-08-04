import Bull from 'bull'
import { aiService } from './aiService.js'
import { updateTrainingData, updateStepsData } from './createBasicSteps.js'
import { DatabaseService } from './prismaService.js'
import { testRedisConnection } from './redisClient.js'

// Redis configuration for Bull (Railway) - handle both naming conventions
const redisConfig = {
  host: process.env.REDIS_HOST || process.env.REDISHOST || 'localhost',
  port: Number(process.env.REDIS_PORT || process.env.REDISPORT || '6379'),
  password: process.env.REDIS_PASSWORD || process.env.REDISPASSWORD,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  // Add TLS for Railway Redis
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
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
      
      // Register job processor after queue is ready
      jobQueue.process('process-video', processVideoJob)
      console.log('✅ Job processor registered')
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
    await DatabaseService.updateModuleStatus(moduleId, 'processing', 0, 'Starting AI processing...')

    perfLogger.logAIStart(moduleId)

    // Step 1: AI processing
    console.log(`🧠 [${moduleId}] Starting AI processing...`)
    await DatabaseService.updateModuleStatus(moduleId, 'processing', 10, 'Starting AI analysis...')
    
    const moduleData = await aiService.processVideo(videoUrl)
    
    if (!moduleData) {
      throw new Error('AI processing returned null/undefined result')
    }
    
    console.log(`🧠 [${moduleId}] AI processing completed successfully`)
    console.log(`🧠 [${moduleId}] Result:`, moduleData)
    
    await DatabaseService.updateModuleStatus(moduleId, 'processing', 30, 'AI analysis complete, extracting steps...')

    perfLogger.logTranscriptionComplete(moduleId)

    // Step 2: Generate steps
    console.log(`📋 [${moduleId}] Generating steps...`)
    await DatabaseService.updateModuleStatus(moduleId, 'processing', 50, 'Generating steps...')
    
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    if (!steps || !Array.isArray(steps)) {
      throw new Error('Step generation returned invalid result')
    }
    
    console.log(`📋 [${moduleId}] Generated ${steps.length} steps`)
    
    await DatabaseService.updateModuleStatus(moduleId, 'processing', 60, 'Steps extracted, enhancing with AI...')
    await DatabaseService.createSteps(moduleId, steps)

    perfLogger.logStepsComplete(moduleId)

    // Step 3: Save final results
    console.log(`💾 [${moduleId}] Saving final results...`)
    await DatabaseService.updateModuleStatus(moduleId, 'processing', 80, 'Saving final results...')
    
    await DatabaseService.updateModuleStatus(moduleId, 'complete', 100, 'Processing complete! Your training module is ready.')

    perfLogger.logStepSaveComplete(moduleId)
    perfLogger.logTotalComplete(moduleId)
    
    console.log(`✅ Job complete for moduleId=${moduleId}`)
    
     } catch (error) {
     console.error(`❌ Job failed for moduleId=${moduleId}`, error)
     console.error(`❌ [${moduleId}] Processing failed:`, error)
     console.error(`❌ [${moduleId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
     
     // Update status to failed
     const errorMessage = error instanceof Error ? error.message : 'Unknown error'
     await DatabaseService.updateModuleStatus(moduleId, 'error', 0, `Processing failed: ${errorMessage}`)
     
     // Note: updateTrainingData is no longer needed since we use DatabaseService.updateModuleStatus
     
     // Ensure performance logging cleanup even on error
     perfLogger.logTotalComplete(moduleId)
     
     throw error
   }
}

export { jobQueue } 