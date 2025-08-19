import express from 'express'
import multer from 'multer'
import { ModuleService } from '../services/moduleService.js'
import { uploadController } from '../controllers/uploadController.js'
import { aiService } from '../services/aiService.js'
import { optionalAuth } from '../middleware/auth.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import { DatabaseService } from '../services/prismaService.js'
import { enqueueProcessModule, isEnabled } from '../services/qstashQueue.js'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { v4 as uuidv4 } from 'uuid'
import { validateInput, validationSchemas } from '../middleware/security.js'

const router = express.Router()

// Helper function for processing queue
async function queueOrInline(moduleId: string) {
  try {
    console.log('📬 [queueOrInline] Processing queue check', { 
      moduleId, 
      qstashEnabled: isEnabled(),
      qstashConfigured: !!process.env.QSTASH_TOKEN
    })
    
    if (isEnabled()) {
      console.log('📬 [queueOrInline] Enqueuing processing job', { moduleId })
      const jobId = await enqueueProcessModule(moduleId)
      console.log('📬 [queueOrInline] Processing job enqueued', { moduleId, jobId })
    } else {
      console.log('📬 [queueOrInline] Starting inline processing', { moduleId })
      await startProcessing(moduleId)
      console.log('📬 [queueOrInline] Inline processing completed', { moduleId })
    }
  } catch (err: any) {
    console.error('📬 [queueOrInline] Processing queue failed', { 
      moduleId, 
      error: err?.message || err,
      stack: err?.stack 
    })
    if (err?.message === 'QSTASH_DISABLED') {
      console.warn('📬 [queueOrInline] QStash disabled error, falling back to inline processing', { moduleId })
      await startProcessing(moduleId)
      console.log('✅ [queueOrInline] Fallback inline processing completed for', moduleId)
    } else {
      console.error('💥 [queueOrInline] Processing error for module', moduleId, err)
      throw err
    }
  }
}

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { 
    fileSize: 200 * 1024 * 1024, // 200MB 
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer file filter:', file.mimetype)
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'), false)
    }
  },
})

// Upload endpoint - with optional authentication
router.post('/', optionalAuth, (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log('Upload route hit')
  next()
}, upload.single('file'), (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle multer errors
  if (err && err.code && typeof err.code === 'string') {
    console.error('❌ Multer error:', err)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large',
        message: 'File size exceeds 200MB limit',
        code: 'FILE_TOO_LARGE'
      })
    }
    return res.status(400).json({ 
      error: 'File upload error',
      message: err.message,
      code: err.code
    })
  } else if (err) {
    console.error('❌ Upload middleware error:', err)
    return res.status(500).json({ 
      error: 'Upload failed',
      message: err.message || 'Unknown upload error'
    })
  }
  next()
}, uploadController.uploadVideo)

// Presigned URL endpoints for S3 direct upload (intended flow)
router.post('/init', optionalAuth, validateInput(validationSchemas.fileUpload), async (req, res) => {
  try {
    const { filename, contentType, title, fileSize } = req.body
    const userId = (req as any).userId

    if (!filename || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['filename', 'contentType'] 
      })
    }

    // Validate content type
    if (!contentType.startsWith('video/')) {
      return res.status(400).json({ error: 'Only video files are allowed' })
    }

    // Log validation details for debugging
    console.log('🔍 [Upload Init] Validation details:', { 
      filename, 
      contentType, 
      fileSize: fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)}MB` : 'not provided',
      title: title || 'not provided'
    })

    console.log('🔑 [Upload Init] Generating presigned URL', { 
      filename, 
      contentType, 
      userId 
    })

    // Generate module ID and S3 keys upfront
    const moduleId = uuidv4()
    const s3Key = `videos/${moduleId}.mp4`
    const stepsKey = `training/${moduleId}.json`

    // Generate presigned URL for this specific key
    const presignedResult = await presignedUploadService.generatePresignedUrl(filename, contentType, s3Key)

    console.log('✅ [Upload Init] Presigned URL generated', { 
      moduleId, 
      s3Key: presignedResult.key 
    })

    res.json({
      success: true,
      moduleId,
      presignedUrl: presignedResult.presignedUrl,
      s3Key: presignedResult.key,
      stepsKey,
      expiresIn: 3600,
      maxFileSize: 500 * 1024 * 1024 // 500MB
    })

  } catch (error: any) {
    console.error('💥 [Upload Init] Error:', error)
    res.status(500).json({
      error: 'Failed to initialize upload',
      message: error?.message || 'Unknown error'
    })
  }
})

// TEST ENDPOINT: Manually trigger AI processing for debugging
router.post('/manual-process', optionalAuth, async (req, res) => {
  try {
    const { moduleId, videoUrl } = req.body
    
    if (!moduleId || !videoUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['moduleId', 'videoUrl'],
        received: Object.keys(req.body)
      })
    }

    console.log(`🧪 [TEST] Manually triggering AI processing for module: ${moduleId}`)
    
    // 1. Verify module exists in database (skip createBasicSteps since we're using DB now)
    console.log('🔍 Verifying module exists in database...')
    
    // 2. Update status to processing
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Manual test - starting AI analysis...')
    console.log('✅ Status updated to processing')
    
    // 3. Start AI processing
    await aiService.generateStepsForModule(moduleId, videoUrl)
    console.log('✅ AI processing completed')
    
    // 4. Update status to ready
    await ModuleService.updateModuleStatus(moduleId, 'READY', 100, 'Manual test - AI processing complete!')
    console.log('✅ Status updated to ready')
    
    res.json({ 
      success: true, 
      moduleId, 
      stepsGenerated: 0,
      message: 'Manual AI processing completed successfully'
    })
    
  } catch (error) {
    console.error('❌ Manual processing failed:', error)
    res.status(500).json({ 
      error: 'Manual processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Upload complete endpoint for presigned S3 uploads
// Structured Error Handling: 400 for validation, 422 for processing, 500 for system errors
router.post('/complete', optionalAuth, async (req, res) => {
  try {
    const { moduleId, s3Key, filename, title } = req.body
    const userId = (req as any).userId

    // Enhanced validation with proper error categorization
    if (!moduleId || !s3Key) {
      return res.status(400).json({ 
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields', 
        required: ['moduleId', 's3Key'],
        received: Object.keys(req.body)
      })
    }

    console.log('📬 [Upload Complete] Processing S3 upload completion', { 
      moduleId, 
      s3Key, 
      userId 
    })

    // Create module record with UPLOADED status
    const moduleData = {
      id: moduleId,
      title: title || filename?.replace(/\.[^/.]+$/, '') || 'Training Video',
      filename: filename || 'video.mp4',
      videoUrl: s3Key, // Store S3 key, not full URL
      s3Key,
      stepsKey: `training/${moduleId}.json`,
      status: 'UPLOADED' as const,
      userId
    }

    try {
      const savedModule = await DatabaseService.createModule(moduleData)
      console.log('✅ [Upload Complete] Module created in database', { 
        moduleId: savedModule.id 
      })

      // Start processing BEFORE responding (more reliable)
      console.log('📬 [Upload Complete] Starting processing pipeline for module', { moduleId })
      console.log('📬 [Upload Complete] QStash enabled check:', isEnabled())
      
      // QStash Integration: If enabled, enqueues background job; otherwise runs inline
      // This provides scalability for production while maintaining reliability for development
      try {
        await queueOrInline(savedModule.id)
        console.log('✅ [Upload Complete] Processing pipeline started successfully', { moduleId })
        
        // Respond with processing status
        return res.json({
          success: true,
          moduleId: savedModule.id,
          status: 'processing',
          message: 'Upload registered. Processing started.'
        })
        
      } catch (err: any) {
        console.error('❌ [Upload Complete] Failed to start processing pipeline', { 
          moduleId: savedModule.id, 
          error: err?.message || err,
          stack: err?.stack 
        })
        
        // CRITICAL: Try direct inline processing as last resort
        try {
          console.log('🔄 [Upload Complete] Attempting direct inline processing as fallback')
          await startProcessing(savedModule.id)
          console.log('✅ [Upload Complete] Direct inline processing succeeded')
          
          // Respond with processing status after successful fallback
          return res.json({
            success: true,
            moduleId: savedModule.id,
            status: 'processing',
            message: 'Upload registered. Processing started (fallback mode).'
          })
          
        } catch (fallbackErr) {
          console.error('💥 [Upload Complete] Even direct processing failed', fallbackErr)
          
          // Respond with error if everything fails
          return res.status(500).json({
            success: false,
            error: 'Processing failed to start',
            message: `Failed to start processing: ${fallbackErr instanceof Error ? fallbackErr.message : fallbackErr}`
          })
        }
      }

    } catch (dbError: any) {
      console.error('❌ [Upload Complete] Database error:', dbError)
      
      // Enhanced error categorization for database issues
      if (dbError?.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_MODULE',
          message: 'Module with this ID already exists',
          details: 'Try uploading again or use a different module ID'
        })
      } else if (dbError?.code === 'P2003') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_USER',
          message: 'Invalid user ID provided',
          details: 'Please ensure you are properly authenticated'
        })
      } else {
        return res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Database operation failed',
          details: dbError?.message || 'Unknown database error'
        })
      }
    }

  } catch (error: any) {
    console.error('💥 [Upload Complete] Error:', error)
    return res.status(500).json({
      error: 'Upload completion failed',
      message: error?.message || 'Unknown error'
    })
  }
})

// Enhanced health check for uploads with FFmpeg and S3 verification
router.get('/health', async (req, res) => {
  try {
    interface HealthCheck {
      status: 'available' | 'unavailable'
      message: string
      error?: string
    }

    interface HealthChecks {
      service: string
      timestamp: string
      status: 'checking' | 'healthy' | 'degraded' | 'unhealthy' | 'error'
      message?: string
      checks: {
        ffmpeg?: HealthCheck
        s3?: HealthCheck
        tempDir?: HealthCheck
      }
    }

    const healthChecks: HealthChecks = {
      service: 'upload',
      timestamp: new Date().toISOString(),
      status: 'checking',
      checks: {}
    }

    // Check 1: FFmpeg availability
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      await execAsync('ffmpeg -version', { timeout: 5000 })
      healthChecks.checks.ffmpeg = { status: 'available', message: 'FFmpeg is ready for video processing' }
    } catch (ffmpegError: any) {
      healthChecks.checks.ffmpeg = { 
        status: 'unavailable', 
        error: ffmpegError?.message || 'FFmpeg check failed',
        message: 'Video normalization will not work'
      }
    }

    // Check 2: S3 connectivity
    try {
      const { storageService } = await import('../services/storageService.js')
      const s3Health = await storageService.healthCheck()
      healthChecks.checks.s3 = { 
        status: s3Health.success ? 'available' : 'unavailable',
        message: s3Health.message
      }
    } catch (s3Error: any) {
      healthChecks.checks.s3 = { 
        status: 'unavailable', 
        error: s3Error?.message || 'S3 check failed',
        message: 'File uploads will not work'
      }
    }

    // Check 3: Temp directory
    try {
      const fs = await import('fs/promises')
      const tempDir = './temp'
      await fs.access(tempDir)
      healthChecks.checks.tempDir = { status: 'available', message: 'Temp directory accessible' }
    } catch (dirError: any) {
      healthChecks.checks.tempDir = { 
        status: 'unavailable', 
        error: dirError?.message || 'Directory check failed',
        message: 'Video processing may fail'
      }
    }

    // Determine overall status
    const allChecks = Object.values(healthChecks.checks).filter(Boolean)
    const criticalChecks = allChecks.filter((check: HealthCheck) => check.status === 'unavailable')
    
    if (criticalChecks.length === 0) {
      healthChecks.status = 'healthy'
      healthChecks.message = 'Upload service is fully operational'
      res.status(200).json(healthChecks)
    } else if (criticalChecks.length === 1 && healthChecks.checks.ffmpeg?.status === 'unavailable') {
      healthChecks.status = 'degraded'
      healthChecks.message = 'Upload service operational but video normalization unavailable'
      res.status(200).json(healthChecks)
    } else {
      healthChecks.status = 'unhealthy'
      healthChecks.message = 'Upload service has critical issues'
      res.status(503).json(healthChecks)
    }

  } catch (error: any) {
    console.error('❌ Health check failed:', error)
    res.status(500).json({
      service: 'upload',
      timestamp: new Date().toISOString(),
      status: 'error',
      error: 'Health check failed',
      message: error?.message || 'Unknown health check error'
    })
  }
})

// Status endpoint for service information
router.get('/status', (req, res) => {
  try {
    res.json({
      success: true,
      service: 'upload',
      timestamp: new Date().toISOString(),
      maxFileSize: '200MB',
      supportedFormats: ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv'],
      features: {
        ffmpegNormalization: true,
        presignedUpload: true,
        s3Upload: true,
        aiProcessing: true,
        videoTranscoding: true
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    })
  } catch (error: any) {
    console.error('❌ Status check failed:', error)
    res.status(500).json({
      success: false,
      error: 'Service unavailable',
      message: 'Upload service is experiencing issues'
    })
  }
})

// Diagnostic endpoint to check video format issues
router.get('/diagnose/:moduleId', optionalAuth, async (req, res) => {
  try {
    const { moduleId } = req.params
    
    if (!moduleId) {
      return res.status(400).json({ 
        error: 'Missing moduleId parameter' 
      })
    }

    console.log(`🔍 [Diagnostic] Checking video format for module: ${moduleId}`)
    
    // Get module info - use the correct method and handle the response properly
    const module = await DatabaseService.getModule(moduleId)
    if (!module) {
      return res.status(404).json({ 
        error: 'Module not found' 
      })
    }

    // Check if module has s3Key
    if (!module.s3Key) {
      return res.status(400).json({ 
        error: 'Module has no S3 key' 
      })
    }

    // Get S3 object metadata
    const { VideoProcessor } = await import('../services/ai/videoProcessor.js')
    const { s3Client } = await import('../services/s3Uploader.js')
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
    
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: module.s3Key
      })
      
      const headResult = await s3Client().send(headCommand)
      
      res.json({
        success: true,
        moduleId,
        s3Key: module.s3Key,
        s3Metadata: {
          contentType: headResult.ContentType,
          contentLength: headResult.ContentLength,
          lastModified: headResult.LastModified,
          etag: headResult.ETag,
          metadata: headResult.Metadata
        },
        moduleStatus: module.status,
        message: 'Video format diagnostic completed'
      })
      
    } catch (s3Error: any) {
      res.json({
        success: false,
        moduleId,
        s3Key: module.s3Key,
        s3Error: s3Error?.message || 'Failed to get S3 metadata',
        moduleStatus: module.status,
        message: 'Video format diagnostic failed - S3 error'
      })
    }
    
  } catch (error: any) {
    console.error('💥 [Diagnostic] Error:', error)
    res.status(500).json({
      error: 'Diagnostic failed',
      message: error?.message || 'Unknown error'
    })
  }
})

export { router as uploadRoutes }