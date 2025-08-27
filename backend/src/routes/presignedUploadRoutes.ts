import express from 'express'
import { presignedUploadController } from '../controllers/presignedUploadController.js'
import { optionalAuth } from '../middleware/auth.js'

const router = express.Router()

// Add authentication middleware to all routes
router.use(optionalAuth)

router.post('/presigned-url', presignedUploadController.getPresignedUrl)
// Removed: confirm, process endpoints (dead code - frontend uses /upload/complete now)
router.get('/status/:key', presignedUploadController.getUploadStatus)
router.get('/health', presignedUploadController.healthCheck)

export { router as presignedUploadRoutes }
