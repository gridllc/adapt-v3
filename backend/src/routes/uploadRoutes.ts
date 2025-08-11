import express from 'express'
import multer from 'multer'
import { uploadController } from '../controllers/uploadController.js'
import { presignedUploadController } from '../controllers/presignedUploadController.js'

const router = express.Router()

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'), false)
    }
  },
})

// ✅ THIS ROUTE MUST WORK - it uploads to S3 via your backend
router.post('/', upload.single('file'), uploadController.uploadVideo)

// Presigned upload routes
router.post('/presigned-url', presignedUploadController.getPresignedUrl)
router.post('/process', presignedUploadController.processVideo)
router.post('/confirm', presignedUploadController.confirmUpload)
router.get('/status/:key', presignedUploadController.getUploadStatus)
router.get('/health', presignedUploadController.healthCheck)

export { router as uploadRoutes }