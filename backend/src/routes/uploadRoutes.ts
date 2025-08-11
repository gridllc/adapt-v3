import express from 'express'
import multer from 'multer'
import { uploadController } from '../controllers/uploadController.js'
import config from '../config/env.js'

const router = express.Router()

// Configure multer for legacy uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE, // Use config value (200MB)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  },
})

// NEW: Presigned URL routes
router.post('/presigned-url', uploadController.getPresignedUrl)
router.post('/process', uploadController.processVideo)

// KEEP: Legacy upload endpoint for backwards compatibility
router.post('/', upload.single('file'), uploadController.uploadVideo)

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'upload-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      presignedUpload: true,
      legacyUpload: true,
      maxFileSize: `${config.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      allowedTypes: config.ALLOWED_VIDEO_TYPES.split(',').map(t => t.trim())
    }
  })
})

export { router as uploadRoutes }
