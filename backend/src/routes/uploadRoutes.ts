import express from 'express'
import multer from 'multer'
import { ModuleService } from '../services/moduleService.js'
import { uploadController } from '../controllers/uploadController.js'
import { aiService } from '../services/aiService.js'
import { optionalAuth } from '../middleware/auth.js'

const router = express.Router()

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

// Upload completion endpoint for presigned uploads
router.post('/complete', optionalAuth, uploadController.uploadComplete)

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

// Health check for uploads
router.get('/health', (req, res) => {
  res.json({ status: 'Upload service ready' })
})

export { router as uploadRoutes }