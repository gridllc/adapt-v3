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
import { logger } from '../utils/structuredLogger.js'

const router = express.Router()

// Helper function for processing queue
async function queueOrInline(moduleId: string) {
  try {
    logger.info('Processing queue check', { 
      moduleId, 
      qstashEnabled: isEnabled(),
      qstashConfigured: !!process.env.QSTASH_TOKEN
    })
    
    if (isEnabled()) {
      logger.info('Enqueuing processing job', { moduleId })
      const jobId = await enqueueProcessModule(moduleId)
      logger.info('Processing job enqueued', { moduleId, jobId })
    } else {
      logger.info('Starting inline processing', { moduleId })
      await startProcessing(moduleId)
      logger.info('Inline processing completed', { moduleId })
    }
  } catch (err: any) {
    logger.error('Processing queue failed', { 
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
router.post('/complete', optionalAuth, async (req, res) => {
  try {
    const { moduleId, s3Key, filename, title } = req.body
    const userId = (req as any).userId

    if (!moduleId || !s3Key) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['moduleId', 's3Key'] 
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

    const savedModule = await DatabaseService.createModule(moduleData)
    console.log('✅ [Upload Complete] Module created in database', { 
      moduleId: savedModule.id 
    })

    // Start processing BEFORE responding (more reliable)
    console.log('📬 [Upload Complete] Starting processing pipeline for module', { moduleId })
    console.log('📬 [Upload Complete] QStash enabled check:', isEnabled())
    
    try {
      await queueOrInline(savedModule.id)
      console.log('✅ [Upload Complete] Processing pipeline started successfully', { moduleId })
      
      // Respond with processing status
      res.json({
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
        res.json({
          success: true,
          moduleId: savedModule.id,
          status: 'processing',
          message: 'Upload registered. Processing started (fallback mode).'
        })
        
      } catch (fallbackErr) {
        console.error('💥 [Upload Complete] Even direct processing failed', fallbackErr)
        
        // Respond with error if everything fails
        res.status(500).json({
          success: false,
          error: 'Processing failed to start',
          message: `Failed to start processing: ${fallbackErr instanceof Error ? fallbackErr.message : fallbackErr}`
        })
      }
    }

  } catch (error: any) {
    console.error('💥 [Upload Complete] Error:', error)
    res.status(500).json({
      error: 'Upload completion failed',
      message: error?.message || 'Unknown error'
    })
  }
})

// Health check for uploads
router.get('/health', (req, res) => {
  res.json({ status: 'Upload service ready' })
})

export { router as uploadRoutes }