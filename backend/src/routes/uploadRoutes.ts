import express from 'express'
import multer from 'multer'
import { uploadController } from '../controllers/uploadController.js'
import { createBasicSteps } from '../services/createBasicSteps.js'
import { ModuleService } from '../services/moduleService.js'
import { aiService } from '../services/aiService.js'

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

// Upload endpoint - NO AUTHENTICATION
router.post('/', (req, res, next) => {
  console.log('Upload route hit')
  next()
}, upload.single('file'), uploadController.uploadVideo)

// TEST ENDPOINT: Manually trigger AI processing for debugging
router.post('/manual-process', async (req, res) => {
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
    
    // 1. Create basic step files
    await createBasicSteps(moduleId, 'manual-test')
    console.log('✅ Basic step files created')
    
    // 2. Update status to processing
    await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Manual test - starting AI analysis...')
    console.log('✅ Status updated to processing')
    
    // 3. Start AI processing
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    console.log(`✅ AI processing completed, generated ${steps?.length || 0} steps`)
    
    // 4. Update status to ready
    await ModuleService.updateModuleStatus(moduleId, 'ready', 100, 'Manual test - AI processing complete!')
    console.log('✅ Status updated to ready')
    
    res.json({ 
      success: true, 
      moduleId, 
      stepsGenerated: steps?.length || 0,
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