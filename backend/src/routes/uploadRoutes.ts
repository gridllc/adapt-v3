import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'
import { uploadVideo, finalizeDirectUpload } from '../controllers/uploadController.js'
import { multipartController } from '../controllers/multipartController.js'
import { getUploadPresignedUrl, isS3Configured } from '../services/s3Uploader.js'
import { validateFile } from '../utils/fileValidation.js'
import { getUploadConfig } from '../config/env.js'
import { logBlockedEvent } from '../utils/logBlockedEvent.js'

// Rate limiting configuration (commented out due to TypeScript compatibility issues)
// const uploadLimiter = rateLimit({
//   windowMs: 10 * 60 * 1000, // 10 minutes
//   max: 5, // limit each IP to 5 uploads per windowMs
//   handler: async (req, res) => {
//     // Log the blocked event
//     await logBlockedEvent({
//       ip: req.ip,
//       userId: req.user?.id,
//       reason: 'Upload rate limit exceeded'
//     })
//     
//     res.status(429).json({
//       success: false,
//       error: 'Upload rate limit exceeded',
//       message: 'Please wait before uploading more files',
//       code: 'UPLOAD_LIMIT',
//       type: 'RATE_LIMIT'
//     })
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// 🎯 Get upload configuration from environment
const uploadConfig = getUploadConfig()

// 🎯 Configure multer for file uploads
const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: {
    fileSize: uploadConfig.maxFileSize, // Use environment config
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // 🎯 Validate file type using environment config
    if (!uploadConfig.allowedVideoTypes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed types: ${uploadConfig.allowedVideoTypes.join(', ')}`), false)
    }
    cb(null, true)
  }
})

// 🎯 Upload endpoint with enhanced error handling
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as any // Type assertion for multer file
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please select a video file to upload',
        code: 'NO_FILE',
        type: 'VALIDATION_ERROR'
      })
    }

    // 🎯 Enhanced validation with error codes
    const validation = validateFile(file)
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        message: validation.error,
        code: validation.code,
        type: 'VALIDATION_ERROR'
      })
    }

    // 🎯 Process the upload
    const result = await uploadVideo(file, req.user?.id)
    
    return res.status(200).json({
      success: true,
      moduleId: result.moduleId,
      videoUrl: result.videoUrl,
      title: result.title,
      redirectUrl: `/training/${result.moduleId}`,
      message: 'Video uploaded successfully',
      fileInfo: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      }
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error.message || 'An error occurred during upload',
      code: 'UPLOAD_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

// 🎯 Direct-to-cloud: issue presigned PUT URL
router.post('/upload/presign', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(400).json({ success: false, error: 'Cloud storage not configured' })
    }
    const { filename, contentType } = req.body as { filename?: string; contentType?: string }
    if (!filename || !contentType) {
      return res.status(400).json({ success: false, error: 'filename and contentType are required' })
    }
    const url = await getUploadPresignedUrl(filename, contentType)
    return res.json({ success: true, url })
  } catch (error: any) {
    console.error('Presign error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Failed to presign' })
  }
})

// 🎯 Finalize after client PUTs to presigned URL
router.post('/upload/finalize', finalizeDirectUpload)

// 🎯 Multipart upload endpoints
router.post('/uploads/start', multipartController.startUpload)
router.post('/uploads/sign', multipartController.signPart)
router.post('/uploads/complete', multipartController.completeUpload)
router.post('/uploads/abort', multipartController.abortUpload)

// 🎯 Health check for upload service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'upload',
    timestamp: new Date().toISOString()
  })
})

export default router 