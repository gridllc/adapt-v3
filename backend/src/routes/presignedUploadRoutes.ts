import express from 'express'
import { presignedUploadController } from '../controllers/presignedUploadController.js'
import { optionalAuth } from '../middleware/auth.js'

const router = express.Router()

// Add authentication middleware to all routes
router.use(optionalAuth)

router.post('/presigned-url', presignedUploadController.getPresignedUrl)
router.post('/playback-url', presignedUploadController.getPlaybackUrl)

export { router as presignedUploadRoutes }
