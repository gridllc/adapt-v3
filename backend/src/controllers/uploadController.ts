import { Request, Response } from 'express'
import { storageService } from '../services/storageService.js'
import { createBasicSteps } from '../services/createBasicSteps.js'
import { aiService } from '../services/aiService.js'
import { ModuleService } from '../services/moduleService.js'

export const uploadController = {
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
      const videoUrl = await storageService.uploadVideo(file)
      console.log('✅ Video upload completed:', videoUrl)

      // Create module data
      const moduleData = {
        title: file.originalname.replace(/\.[^/.]+$/, ''), // Remove file extension
        filename: file.originalname,
        videoUrl: videoUrl,
        steps: [
          { id: 1, timestamp: 0, title: 'Introduction', description: 'Getting started', duration: 30 },
          { id: 2, timestamp: 30, title: 'Main content', description: 'Core training', duration: 60 },
          { id: 3, timestamp: 90, title: 'Conclusion', description: 'Wrapping up', duration: 20 }
        ],
      }

      // Save module using storageService (database or mock)
      console.log('💾 Saving module data...')
      let moduleId: string
      try {
        moduleId = await storageService.saveModule(moduleData)
        console.log('✅ Module saved:', moduleId)
      } catch (saveError) {
        console.error('❌ Failed to save module:', saveError)
        return res.status(500).json({ 
          error: 'Failed to save module',
          userMessage: 'Your video was uploaded but we could not save the module data. Please try again.',
          technicalDetails: saveError instanceof Error ? saveError.message : 'Unknown error',
          code: 'MODULE_SAVE_FAILED'
        })
      }

      // 🚀 CRITICAL: Trigger AI processing pipeline DIRECTLY
      console.log('🤖 Starting AI processing pipeline...')
      
      try {
        // 1. Create basic step files to prevent "Steps not found" errors
        console.log('📝 Creating basic step files...')
        try {
          await createBasicSteps(moduleId, file.originalname)
          console.log('✅ Basic step files created')
        } catch (stepsError) {
          console.error('❌ Failed to create basic steps:', stepsError)
          throw new Error(`Basic steps creation failed: ${stepsError instanceof Error ? stepsError.message : 'Unknown error'}`)
        }

        // 2. Update module status to processing
        console.log('🔄 Updating module status to processing...')
        try {
          await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Starting AI analysis...')
          console.log('✅ Module status updated to processing')
        } catch (statusError) {
          console.error('❌ Failed to update module status:', statusError)
          throw new Error(`Status update failed: ${statusError instanceof Error ? statusError.message : 'Unknown error'}`)
        }

        // 3. Start AI processing in background (don't await - let it run async)
        console.log('🧠 Starting AI processing in background...')
        aiService.generateStepsForModule(moduleId, videoUrl)
          .then(async (steps) => {
            console.log(`✅ AI processing completed for ${moduleId}, generated ${steps?.length || 0} steps`)
            
            if (steps && Array.isArray(steps)) {
              // Update progress to 100% and status to ready
              await ModuleService.updateModuleStatus(moduleId, 'ready', 100, 'AI processing complete!')
              console.log(`🎉 Module ${moduleId} is now ready with ${steps.length} steps`)
            } else {
              throw new Error('AI processing returned invalid steps')
            }
          })
          .catch(async (error) => {
            console.error(`❌ AI processing failed for ${moduleId}:`, error)
            await ModuleService.updateModuleStatus(moduleId, 'failed', 0, `AI processing failed: ${error.message}`)
          })

        console.log('✅ AI processing job started in background')

      } catch (processingError) {
        console.error('⚠️ AI processing setup failed, but upload succeeded:', processingError)
        // Don't fail the upload if AI processing setup fails
        // The user can still view the video, just without AI-generated steps
        
        // Update module status to indicate AI processing failed
        try {
          await ModuleService.updateModuleStatus(moduleId, 'failed', 0, `AI processing setup failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`)
        } catch (statusError) {
          console.error('❌ Failed to update module status after AI processing failure:', statusError)
        }
        
        // Return success but with warning about AI processing
        const response = {
          success: true,
          moduleId: moduleId,
          videoUrl: videoUrl,
          steps: moduleData.steps,
          status: 'completed_without_ai',
          message: 'Video uploaded successfully, but AI processing could not be started. You can still view the video.',
          warning: 'AI-generated steps are not available for this video.',
          code: 'AI_PROCESSING_SETUP_FAILED'
        }
        return res.json(response)
      }

      const response = {
        success: true,
        moduleId: moduleId,
        videoUrl: videoUrl,
        steps: moduleData.steps,
        status: 'processing', // Indicate that AI processing is happening
        message: 'Video uploaded successfully. AI processing started...'
      }

      console.log('✅ Returning success response:', response)
      res.json(response)

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
