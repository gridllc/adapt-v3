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

// Upload endpoint
router.post('/', upload.single('file'), uploadController.uploadVideo)

export { router as uploadRoutes } 