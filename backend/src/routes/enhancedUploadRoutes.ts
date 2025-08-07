import express from 'express'
import multer from 'multer'
import { 
  uploadQueue, 
  chunkedUploadManager, 
  resumableUploadManager, 
  batchUploadManager,
  videoProcessor,
  calculateChunkSize,
  validateChunkInfo,
  formatUploadProgress
} from '../utils/uploadUtils.js'
import { validateFile } from '../utils/fileValidation.js'
import { getUploadConfig } from '../config/env.js'
import { uploadVideo } from '../controllers/uploadController.js'

const router = express.Router()
const uploadConfig = getUploadConfig()

// 🎯 Configure multer for enhanced uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadConfig.maxFileSize,
    files: 10 // Allow multiple files for batch uploads
  },
  fileFilter: (req, file, cb) => {
    if (uploadConfig.allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false)
    }
  }
})

// 🎯 Chunked Upload Endpoint
router.post('/chunked', upload.single('chunk'), async (req, res) => {
  try {
    const { chunkNumber, totalChunks, chunkSize, totalSize, fileId, fileName } = req.body
    const chunkData = req.file?.buffer

    if (!chunkData) {
      return res.status(400).json({
        success: false,
        error: 'No chunk data received',
        code: 'NO_CHUNK_DATA',
        type: 'VALIDATION_ERROR'
      })
    }

    const chunkInfo = {
      chunkNumber: parseInt(chunkNumber),
      totalChunks: parseInt(totalChunks),
      chunkSize: parseInt(chunkSize),
      totalSize: parseInt(totalSize),
      fileId,
      fileName
    }

    if (!validateChunkInfo(chunkInfo)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chunk information',
        code: 'INVALID_CHUNK_INFO',
        type: 'VALIDATION_ERROR'
      })
    }

    const result = await chunkedUploadManager.processChunk(chunkInfo, chunkData)
    
    return res.status(200).json({
      success: true,
      message: result.message,
      chunkNumber: chunkInfo.chunkNumber,
      totalChunks: chunkInfo.totalChunks,
      progress: formatUploadProgress(
        (chunkInfo.chunkNumber + 1) * chunkInfo.chunkSize,
        chunkInfo.totalSize
      )
    })

  } catch (error) {
    console.error('Chunked upload error:', error)
    return res.status(500).json({
      success: false,
      error: 'Chunked upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'CHUNK_UPLOAD_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

// 🎯 Resumable Upload Endpoints
router.post('/resumable/init', async (req, res) => {
  try {
    const { fileName, totalSize, userId } = req.body

    if (!fileName || !totalSize || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        code: 'MISSING_PARAMETERS',
        type: 'VALIDATION_ERROR'
      })
    }

    const sessionId = resumableUploadManager.createSession(userId, fileName, totalSize)
    
    return res.status(200).json({
      success: true,
      sessionId,
      message: 'Upload session created'
    })

  } catch (error) {
    console.error('Resumable upload init error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to initialize upload session',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'SESSION_INIT_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

router.post('/resumable/chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { sessionId, chunkNumber } = req.body
    const chunkData = req.file?.buffer

    if (!chunkData || !sessionId || chunkNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        code: 'MISSING_PARAMETERS',
        type: 'VALIDATION_ERROR'
      })
    }

    const session = resumableUploadManager.getSession(sessionId)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found or expired',
        code: 'SESSION_NOT_FOUND',
        type: 'VALIDATION_ERROR'
      })
    }

    const success = resumableUploadManager.updateSession(
      sessionId,
      parseInt(chunkNumber),
      chunkData.length
    )

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to update session',
        code: 'SESSION_UPDATE_FAILED',
        type: 'SERVER_ERROR'
      })
    }

    const progress = formatUploadProgress(session.uploadedSize, session.totalSize)
    
    return res.status(200).json({
      success: true,
      message: 'Chunk uploaded successfully',
      progress,
      uploadedSize: session.uploadedSize,
      totalSize: session.totalSize
    })

  } catch (error) {
    console.error('Resumable chunk upload error:', error)
    return res.status(500).json({
      success: false,
      error: 'Chunk upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'CHUNK_UPLOAD_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

router.get('/resumable/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params
    const session = resumableUploadManager.getSession(sessionId)

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Upload session not found',
        code: 'SESSION_NOT_FOUND',
        type: 'VALIDATION_ERROR'
      })
    }

    return res.status(200).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        fileName: session.fileName,
        uploadedSize: session.uploadedSize,
        totalSize: session.totalSize,
        progress: formatUploadProgress(session.uploadedSize, session.totalSize),
        chunks: Array.from(session.chunks),
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      }
    })

  } catch (error) {
    console.error('Session status error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get session status',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'STATUS_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

// 🎯 Batch Upload Endpoint
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as any[]
    const userId = req.user?.id

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        code: 'NO_FILES',
        type: 'VALIDATION_ERROR'
      })
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHORIZED',
        type: 'AUTH_ERROR'
      })
    }

    // Validate all files
    for (const file of files) {
      const validation = validateFile(file)
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: `File validation failed: ${file.originalname}`,
          message: validation.error,
          code: validation.code,
          type: 'VALIDATION_ERROR'
        })
      }
    }

    const result = await batchUploadManager.processBatch(files, userId)
    
    return res.status(200).json({
      success: true,
      batchId: result.batchId,
      totalFiles: result.totalFiles,
      successful: result.successful,
      failed: result.failed,
      results: result.results,
      message: `Batch upload completed: ${result.successful}/${result.totalFiles} successful`
    })

  } catch (error) {
    console.error('Batch upload error:', error)
    return res.status(500).json({
      success: false,
      error: 'Batch upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'BATCH_UPLOAD_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

// 🎯 Upload Queue Management Endpoints
router.post('/queue', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as any
    const { priority = 'normal' } = req.body
    const userId = req.user?.id

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
        type: 'VALIDATION_ERROR'
      })
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHORIZED',
        type: 'AUTH_ERROR'
      })
    }

    // Validate file
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

    const jobId = await uploadQueue.addJob(userId, file, priority as 'high' | 'normal' | 'low')
    
    return res.status(200).json({
      success: true,
      jobId,
      message: 'Upload job added to queue',
      priority
    })

  } catch (error) {
    console.error('Queue upload error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to add upload to queue',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'QUEUE_ADD_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

router.get('/queue/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = uploadQueue.getJobStatus(jobId)

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        type: 'VALIDATION_ERROR'
      })
    }

    return res.status(200).json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error
      }
    })

  } catch (error) {
    console.error('Job status error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'STATUS_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

router.get('/queue/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const jobs = uploadQueue.getUserJobs(userId)

    return res.status(200).json({
      success: true,
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error
      }))
    })

  } catch (error) {
    console.error('User jobs error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get user jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'JOBS_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

// 🎯 Video Processing Endpoints
router.post('/process/metadata', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as any
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
        type: 'VALIDATION_ERROR'
      })
    }

    const metadata = await videoProcessor.extractMetadata(file)
    
    return res.status(200).json({
      success: true,
      metadata,
      message: 'Metadata extracted successfully'
    })

  } catch (error) {
    console.error('Metadata extraction error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to extract metadata',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'METADATA_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

router.post('/process/thumbnail', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as any
    const { timestamp = 1 } = req.body

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
        type: 'VALIDATION_ERROR'
      })
    }

    const thumbnail = await videoProcessor.generateThumbnail(file, parseFloat(timestamp))
    
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Content-Disposition', 'inline; filename="thumbnail.jpg"')
    return res.status(200).send(thumbnail)

  } catch (error) {
    console.error('Thumbnail generation error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate thumbnail',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'THUMBNAIL_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

router.post('/process/compress', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as any
    const { quality = 'medium' } = req.body

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
        type: 'VALIDATION_ERROR'
      })
    }

    const compressedVideo = await videoProcessor.compressVideo(file, quality as 'low' | 'medium' | 'high')
    
    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('Content-Disposition', `attachment; filename="compressed_${file.originalname}"`)
    return res.status(200).send(compressedVideo)

  } catch (error) {
    console.error('Video compression error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to compress video',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'COMPRESSION_FAILED',
      type: 'SERVER_ERROR'
    })
  }
})

// 🎯 Health check for enhanced upload service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'enhanced-upload',
    features: [
      'chunked-uploads',
      'resumable-uploads', 
      'batch-uploads',
      'upload-queue',
      'video-processing'
    ],
    timestamp: new Date().toISOString()
  })
})

export default router 