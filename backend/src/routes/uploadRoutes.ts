import express from 'express'
import multer from 'multer'
import { uploadController } from '../controllers/uploadController.js'

const router = express.Router()

// Add CORS headers for upload routes
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  next()
})

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  },
})

// Configure multer for chunk uploads (accepts any file type)
const chunkUpload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  // No fileFilter for chunks - accept any file type
})

// Original upload endpoint
router.post('/', upload.single('file'), uploadController.uploadVideo)

// Chunked upload endpoints
router.post('/chunk', chunkUpload.single('chunk'), uploadController.uploadChunk)
router.post('/finalize', uploadController.finalizeUpload)

export { router as uploadRoutes } 