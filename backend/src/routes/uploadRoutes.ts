import express from 'express'
import multer from 'multer'
import { uploadController } from '../controllers/uploadController.js'

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

// Health check for uploads
router.get('/health', (req, res) => {
  res.json({ status: 'Upload service ready' })
})

export { router as uploadRoutes }