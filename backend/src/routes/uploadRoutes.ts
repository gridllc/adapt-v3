import express from 'express'
import multer from 'multer'
import { uploadController } from '../controllers/uploadController.js'

const router = express.Router()

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