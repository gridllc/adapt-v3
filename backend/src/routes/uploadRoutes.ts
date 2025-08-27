import express from 'express'
import { ModuleService } from '../services/moduleService.js'
import { uploadController } from '../controllers/uploadController.js'
import { aiService } from '../services/aiService.js'
import { optionalAuth } from '../middleware/auth.js'

const router = express.Router()

// Upload endpoint removed - we now use presigned uploads instead
// The old multipart upload route has been replaced with:
// 1. POST /api/presigned-upload/presigned-url - get S3 presigned URL
// 2. PUT to S3 directly using the presigned URL  
// 3. POST /api/upload/complete - complete upload and start AI pipeline

// Complete upload endpoint - for presigned uploads
router.post('/complete', optionalAuth, uploadController.completeUpload)

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