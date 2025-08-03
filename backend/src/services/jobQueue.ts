import Bull from 'bull'
import { aiService } from './aiService.js'
import { storageService } from './storageService.js'
import path from 'path'
import fs from 'fs'

// Create Redis connection with better error handling
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 0, // Disable retries to prevent continuous errors
  retryDelayOnFailover: 0, // Disable retry delay
  enableReadyCheck: false, // Disable ready check for better error handling
}

// Create job queue with error handling
let jobQueue: Bull.Queue | any
let useMockQueue = false

// Check if Redis is available before creating Bull queue
function checkRedisConnectionSync() {
  // Skip Redis check if explicitly disabled
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('⚠️ Redis disabled via DISABLE_REDIS environment variable')
    return false
  }
  
  try {
    // For now, assume Redis is not available in development
    console.log('⚠️ Redis not available, using mock queue')
    return false
  } catch (error) {
    console.log('⚠️ Redis not available, using mock queue')
    return false
  }
}

// Initialize job queue synchronously
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

      // Add error handlers for the Bull queue
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
    
    // Create mock queue
    jobQueue = {
      add: async (name: string, data: any) => {
        console.log(`📝 [MOCK] Adding job: ${name}`)
        // Process immediately in development
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

// Initialize the job queue synchronously
initializeJobQueueSync()

// Performance logger for tracking processing times
class PerformanceLogger {
  private metrics = new Map<string, any>()

  startUpload(moduleId: string) {
    this.metrics.set(moduleId, {
      moduleId,
      uploadStart: Date.now()
    })
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
    await updateModuleProgress(moduleId, { 
      status: 'processing', 
      progress: 10,
      message: 'Starting AI analysis...'
    })

    perfLogger.logAIStart(moduleId)

    // Step 1: AI processing
    console.log(`🧠 [${moduleId}] Starting AI processing...`)
    const moduleData = await aiService.processVideo(videoUrl)
    
    await updateModuleProgress(moduleId, { 
      progress: 30,
      message: 'AI analysis complete, extracting steps...'
    })

    perfLogger.logTranscriptionComplete(moduleId)

    // Step 2: Generate steps
    console.log(`📋 [${moduleId}] Generating steps...`)
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    await updateModuleProgress(moduleId, { 
      progress: 60,
      message: 'Steps extracted, enhancing with AI...'
    })

    perfLogger.logStepsComplete(moduleId)

    // Step 3: Transcription and GPT enhancement (if available)
    let trainingData = null
    let enhancedSteps = null
    
    try {
      console.log(`🎯 [${moduleId}] Starting transcription processing...`)
      
      // Get the video file path
      const videoPath = path.join(process.cwd(), 'uploads', `${moduleId}.mp4`)
      
      if (fs.existsSync(videoPath)) {
        const { AudioProcessor } = await import('./audioProcessor.js')
        const audioProcessor = new AudioProcessor()
        
        // Create structured training steps
        trainingData = await audioProcessor.createTrainingStepsFromVideo(videoPath, {
          maxWordsPerStep: 25,
          minStepDuration: 2,
          maxStepDuration: 30,
          confidenceThreshold: 0.6
        })
        
        // Generate GPT-enhanced steps
        enhancedSteps = await audioProcessor.generateGPTEnhancedSteps(videoPath, {
          useWordLevelSegmentation: false,
          enableGPTRewriting: true
        })
        
        perfLogger.logGPTComplete(moduleId)
      }
    } catch (transcriptionError) {
      console.error(`⚠️ [${moduleId}] Transcription processing failed:`, transcriptionError)
      // Continue without transcription
    }

    // Step 4: Save final results
    await updateModuleProgress(moduleId, { 
      progress: 90,
      message: 'Saving training data...'
    })

    // Save the enhanced training data
    const trainingDataPath = path.join(process.cwd(), 'data', 'training', `${moduleId}.json`)
    await fs.promises.mkdir(path.dirname(trainingDataPath), { recursive: true })
    await fs.promises.writeFile(
      trainingDataPath, 
      JSON.stringify({
        moduleId,
        originalSteps: steps,
        structuredSteps: trainingData?.steps || [],
        enhancedSteps: enhancedSteps?.steps || [],
        stepGroups: trainingData?.stepGroups || [],
        stats: trainingData?.stats || {},
        transcript: trainingData?.transcript || '',
        createdAt: new Date().toISOString()
      }, null, 2)
    )

    // Final update: mark as ready
    await updateModuleProgress(moduleId, {
      status: 'ready',
      progress: 100,
      message: 'Training module ready!',
      steps: enhancedSteps?.steps || steps,
      title: moduleData?.title || 'Training Module',
      description: moduleData?.description || '',
      totalDuration: moduleData?.totalDuration || 0
    })

    perfLogger.logTotalComplete(moduleId)
    console.log(`✅ [${moduleId}] Processing complete!`)
    
  } catch (error) {
    console.error(`❌ [${moduleId}] Processing failed:`, error)
    
    await updateModuleProgress(moduleId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    throw error
  }
}

// Process video analysis jobs
if (jobQueue && typeof jobQueue.process === 'function') {
  jobQueue.process('process-video', processVideoJob)
} else {
  console.log('⚠️ Job queue not properly initialized, using mock processing')
}

// Helper function to update module progress
async function updateModuleProgress(moduleId: string, updates: any) {
  try {
    // Update modules.json
    const modulesPath = path.join(process.cwd(), 'data', 'modules.json')
    let modules = []
    
    try {
      const raw = await fs.promises.readFile(modulesPath, 'utf-8')
      modules = JSON.parse(raw)
    } catch {
      modules = []
    }
    
    const moduleIndex = modules.findIndex((m: any) => m.id === moduleId)
    if (moduleIndex >= 0) {
      modules[moduleIndex] = { ...modules[moduleIndex], ...updates }
    } else {
      modules.push({ id: moduleId, ...updates })
    }
    
    await fs.promises.writeFile(modulesPath, JSON.stringify(modules, null, 2))
    
    console.log(`📊 [${moduleId}] Progress updated: ${updates.progress || 0}%`)
  } catch (error) {
    console.error(`❌ [${moduleId}] Failed to update progress:`, error)
  }
}

export { jobQueue } 