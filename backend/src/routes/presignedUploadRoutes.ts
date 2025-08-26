import express from 'express'
import { presignedUploadController } from '../controllers/presignedUploadController.js'
import { optionalAuth } from '../middleware/auth.js'

const router = express.Router()

// Add authentication middleware to all routes
router.use(optionalAuth)

router.post('/presigned-url', presignedUploadController.getPresignedUrl)
router.post('/process', presignedUploadController.processVideo)
router.post('/confirm', presignedUploadController.confirmUpload)
router.get('/status/:key', presignedUploadController.getUploadStatus)
router.get('/health', presignedUploadController.healthCheck)

export { router as presignedUploadRoutes }
