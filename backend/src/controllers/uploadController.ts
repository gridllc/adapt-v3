import { Request, Response } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { storageService } from '../services/storageService.js'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { enqueueProcessModule, processModuleDirectly, isEnabled } from '../services/qstashQueue.js'
import { v4 as uuidv4 } from 'uuid'

// Single processing function - either enqueue or run inline
async function queueOrInline(moduleId: string) {
  try {
    // If QStash is enabled, try to enqueue
    if (isEnabled()) {
      const jobId = await enqueueProcessModule(moduleId)
      console.log('📬 Enqueued processing job', { moduleId, jobId })
    } else {
      // QStash disabled - run inline processing
      console.log('⚙️ QStash disabled, running inline processing:', moduleId)
      await startProcessing(moduleId)
    }
  } catch (e: any) {
    // Handle QStash disabled gracefully, fall back to inline processing
    if (e?.message === 'QSTASH_DISABLED') {
      console.log('📬 QStash disabled, running inline processing:', moduleId)
      await startProcessing(moduleId)
    } else {
      console.error('Processing error:', e)
      throw e
    }
  }
}

export const uploadController = {
  /**
   * Complete upload after S3 presigned upload
   * This is the missing piece that starts the AI pipeline
   */
  async completeUpload(req: Request, res: Response) {
    try {
      const { moduleId, key, filename, contentType, size } = req.body
      
      if (!moduleId || !key) {
        console.log('❌ Complete upload missing required fields:', { moduleId: !!moduleId, key: !!key })
        return res.status(400).json({ 
          ok: false, 
          error: 'moduleId and key required' 
        })
      }

      console.log('📝 [UPLOAD] complete', { moduleId, key, filename, contentType, size })

      // Mark module as uploaded
      await ModuleService.updateModuleStatus(moduleId, 'UPLOADED', 0, 'Upload completed')
      
      // Start the AI pipeline
      console.log('🚀 [PIPELINE] start', { moduleId })
      await queueOrInline(moduleId)

      return res.json({ ok: true, moduleId })
    } catch (error) {
      console.error('❌ Complete upload failed:', error)
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to complete upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  async uploadVideo(req: Request, res: Response) {
    try {
      console.log('=== UPLOAD CONTROLLER HIT ===')
      console.log('Method:', req.method)
      console.log('Headers:', req.headers)
      console.log('Body keys:', Object.keys(req.body || {}))
      console.log('File:', req.file ? 'FILE PRESENT' : 'NO FILE')

      if (!req.file) {
        console.log('ERROR: No file in request')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      console.log('File details:', {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      })
      
      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        console.log('ERROR: Invalid file type')
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      console.log('✅ File validated successfully')

      // Additional file integrity check
      console.log('🔍 File integrity check:', {
        size: file.size,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        bufferLength: file.buffer?.length || 0,
        bufferValid: file.buffer && file.buffer.length > 0
      })

      // Check if file is too small (likely corrupted)
      if (file.size < 1000) { // Less than 1KB
        console.error('❌ File too small, likely corrupted:', file.size)
        return res.status(400).json({ 
          error: 'File appears to be corrupted or incomplete',
          userMessage: 'The uploaded file is too small and appears to be corrupted. Please try uploading the video again.',
          size: file.size,
          code: 'FILE_CORRUPTED'
        })
      }

      // Check if file is unreasonably large (likely corrupted)
      if (file.size > 500 * 1024 * 1024) { // More than 500MB
        console.error('❌ File too large, likely corrupted:', file.size)
        return res.status(400).json({ 
          error: 'File size exceeds reasonable limits',
          userMessage: 'The uploaded file is unusually large and may be corrupted. Please check the file and try again.',
          size: file.size,
          maxSize: '500MB',
          code: 'FILE_TOO_LARGE'
        })
      }

      // Check if buffer is valid
      if (!file.buffer || file.buffer.length === 0) {
        console.error('❌ File buffer is empty or invalid')
        return res.status(400).json({ 
          error: 'File buffer is empty or invalid',
          userMessage: 'The uploaded file could not be read properly. Please try uploading the video again.',
          bufferLength: file.buffer?.length || 0,
          code: 'FILE_BUFFER_INVALID'
        })
      }

      // Check if buffer size matches file size
      if (file.buffer.length !== file.size) {
        console.error('❌ Buffer size mismatch:', { bufferLength: file.buffer.length, fileSize: file.size })
        return res.status(400).json({ 
          error: 'File size mismatch detected',
          userMessage: 'The uploaded file appears to be incomplete. Please try uploading the video again.',
          bufferLength: file.buffer.length,
          fileSize: file.size,
          code: 'FILE_SIZE_MISMATCH'
        })
      }

      // Upload video using storageService (S3 or mock)
      console.log('🚀 Starting video upload...')
      
      // Generate canonical S3 key first
      const moduleId = uuidv4() // Generate UUID here for consistent key
      const s3Key = `videos/${moduleId}.mp4`
      const stepsKey = `training/${moduleId}.json`
      
      console.log('🔑 Generated canonical keys:', { s3Key, stepsKey })
      
      // Upload with the canonical key
      const videoUrl = await storageService.uploadVideoWithKey(file, s3Key)
      console.log('✅ Video upload completed:', videoUrl)

      // Create module data with canonical keys
      const moduleData = {
        id: moduleId, // Use the pre-generated ID
        title: file.originalname.replace(/\.[^/.]+$/, ''), // Remove file extension
        filename: file.originalname, // Store original filename only (no UUID prefix)
        videoUrl: videoUrl, // Keep original URL for compatibility
        s3Key: s3Key, // Store canonical S3 key
        stepsKey: stepsKey, // Store canonical steps key
        status: 'UPLOADED' as const,
      }

      // Save module using storageService (database or mock)
      console.log('💾 Saving module data...')
      let savedModuleId: string
      try {
        // Pass the user ID if authenticated
        const userId = (req as any).userId
        console.log('👤 User ID for module creation:', userId || 'No user authenticated')
        
        savedModuleId = await storageService.saveModule(moduleData, userId)
        console.log('✅ Module saved with ID:', savedModuleId)
        console.log('🔍 Module ID type check:', {
          isMock: savedModuleId.startsWith('mock_module_'),
          isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedModuleId),
          length: savedModuleId.length,
          value: savedModuleId
        })
      } catch (saveError) {
        console.error('❌ Failed to save module:', saveError)
        return res.status(500).json({ 
          error: 'Failed to save module',
          userMessage: 'Your video was uploaded but we could not save the module data. Please try again.',
          technicalDetails: saveError instanceof Error ? saveError.message : 'Unknown error',
          code: 'MODULE_SAVE_FAILED'
        })
      }

      // Send success response immediately
      const response = {
        success: true,
        moduleId: savedModuleId,
        videoUrl: s3Key,        // keep canonical key, not a local path
        status: 'uploaded',
        steps: [],
        message: 'Video uploaded successfully. AI processing will start shortly...'
      }

      console.log('✅ Returning success response:', response)
      res.json(response)

      // fire-and-forget AFTER sending the response
      queueMicrotask(async () => {
        try {
          console.log('[Upload] Starting inline processing for', savedModuleId)
          
          // Single processing function - no duplicate calls
          await queueOrInline(savedModuleId)
          
        } catch (err) {
          console.error('Auto-enqueue failed:', err)
          // Don't update status here - let the pipeline handle it
        }
      })

    } catch (error) {
      console.error('💥 Upload controller error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      
      // Provide user-friendly error messages based on error type
      let userMessage = 'An unexpected error occurred during upload. Please try again.'
      let errorCode = 'UNKNOWN_ERROR'
      
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        userMessage = 'The upload system encountered a file system error. Please try uploading again.'
        errorCode = 'FILE_SYSTEM_ERROR'
      } else if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
        userMessage = 'The upload system does not have permission to process your file. Please contact support.'
        errorCode = 'PERMISSION_ERROR'
      } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        userMessage = 'The upload took too long and timed out. Please try uploading a smaller file or check your internet connection.'
        errorCode = 'TIMEOUT_ERROR'
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        userMessage = 'A network error occurred during upload. Please check your internet connection and try again.'
        errorCode = 'NETWORK_ERROR'
      }
      
      res.status(500).json({ 
        error: 'Upload failed',
        userMessage: userMessage,
        technicalDetails: errorMessage,
        errorCode: errorCode,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      })
    }
  },
}
