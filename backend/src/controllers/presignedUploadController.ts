import { Request, Response } from 'express'
import { presignedUploadService } from '../services/presignedUploadService.js'
import { aiService } from '../services/aiService.js'
import { DatabaseService } from '../services/prismaService.js'
import crypto from 'crypto'
import { log } from '../utils/logger.js'

// Types for better type safety
interface PresignedUrlRequest {
  filename: string
  contentType: string
  userId?: string
}

interface ProcessVideoRequest {
  videoUrl: string
  userId?: string
  moduleId: string
}

interface ConfirmUploadRequest {
  key: string
  userId?: string
}

export const presignedUploadController = {
  /**
   * Generate a presigned URL for direct S3 upload
   */
  async getPresignedUrl(req: Request, res: Response) {
    try {
      const { filename, contentType, userId }: PresignedUrlRequest = req.body
      
      // Validate required fields
      if (!filename || !contentType) {
        log.warn('Presigned URL request missing required fields', { 
          filename: !!filename, 
          contentType: !!contentType,
          userId 
        })
        return res.status(400).json({ 
          error: 'filename and contentType are required' 
        })
      }

      // Validate file type
      if (!contentType.startsWith('video/')) {
        log.warn('Invalid content type for presigned URL', { 
          contentType, 
          userId 
        })
        return res.status(400).json({ 
          error: 'Only video files are allowed' 
        })
      }

      // Validate filename
      if (filename.length > 255) {
        log.warn('Filename too long', { 
          filenameLength: filename.length, 
          userId 
        })
        return res.status(400).json({ 
          error: 'Filename must be less than 255 characters' 
        })
      }

      // Generate moduleId first - this ensures consistency across the upload flow
      const moduleId = crypto.randomUUID()
      
      log.info('Generating presigned URL', { 
        filename, 
        contentType, 
        moduleId,
        userId 
      })

      const result = await presignedUploadService.generatePresignedUrl(
        filename, 
        contentType,
        moduleId
      )
      
      // Create the module record immediately - this ensures it exists for the complete step
      try {
        const originalFilename = filename.replace(/\.[^/.]+$/, '') // Remove file extension for title
        const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${result.key}`
        
        await DatabaseService.createModule({
          id: moduleId,
          title: originalFilename,
          filename: filename,
          videoUrl: fileUrl,
          s3Key: result.key,
          stepsKey: `training/${moduleId}.json`,
          status: 'UPLOADING' as const,
          userId: userId || undefined
        })
        
        log.info('Module created for presigned upload', { 
          moduleId,
          filename,
          userId 
        })
      } catch (dbError) {
        log.error('Failed to create module for presigned upload', { 
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          moduleId,
          userId 
        })
        // Continue anyway - the upload can still work and the module can be created later
      }
      
      log.info('Presigned URL generated successfully', { 
        filename, 
        key: result.key,
        moduleId,
        userId 
      })
      
      res.json({
        ok: true,
        uploadUrl: result.uploadUrl,
        key: result.key,
        moduleId: result.moduleId,
        expiresIn: 300, // 5 minutes
        maxFileSize: 500 * 1024 * 1024 // 500MB limit
      })
    } catch (error) {
      log.error('Presigned URL generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.body?.userId 
      })
      res.status(500).json({ 
        error: 'Failed to generate upload URL',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      })
    }
  },

  /**
   * Process uploaded video with AI analysis
   */
  async processVideo(req: Request, res: Response) {
    try {
      const { videoUrl, userId, moduleId }: ProcessVideoRequest = req.body
      
      if (!videoUrl) {
        log.warn('Video processing request missing videoUrl', { userId })
        return res.status(400).json({ error: 'videoUrl is required' })
      }

      if (!moduleId) {
        log.warn('Video processing request missing moduleId', { userId })
        return res.status(400).json({ error: 'moduleId is required' })
      }

      // Validate video URL format
      if (!videoUrl.startsWith('http') && !videoUrl.startsWith('https')) {
        log.warn('Invalid video URL format', { videoUrl, userId })
        return res.status(400).json({ error: 'Invalid video URL format' })
      }

      log.info('Starting video processing', { 
        videoUrl, 
        userId, 
        moduleId 
      })

      // Use the proper AI pipeline
      const { startProcessing } = await import('../services/ai/aiPipeline.js')
      await startProcessing(moduleId)

      log.info('AI processing started successfully', { 
        moduleId,
        userId 
      })

      res.json({
        success: true,
        moduleId: moduleId,
        videoUrl,
        message: 'AI processing started successfully'
      })
    } catch (error) {
      log.error('Video processing failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        videoUrl: req.body?.videoUrl,
        moduleId: req.body?.moduleId,
        userId: req.body?.userId 
      })
      res.status(500).json({ 
        error: 'Video processing failed',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      })
    }
  },

  /**
   * Confirm that a file was successfully uploaded to S3
   */
  async confirmUpload(req: Request, res: Response) {
    try {
      const { key, userId }: ConfirmUploadRequest = req.body
      
      console.log('🚀 [confirmUpload] Starting upload confirmation...')
      console.log('📝 [confirmUpload] Request body:', req.body)
      
      if (!key) {
        log.warn('Confirm upload request missing key', { userId })
        return res.status(400).json({ error: 'key is required' })
      }

      log.info('Confirming upload', { key, userId })
      console.log('🔑 [confirmUpload] Processing key:', key)

      const result = await presignedUploadService.confirmUpload(key)
      
      if (result.success) {
        console.log('✅ [confirmUpload] S3 confirmation successful, creating module...')
        
        // Extract moduleId from the new key format: training/${moduleId}/${uuid}-${filename}
        const keyParts = key.split('/')
        if (keyParts.length < 3 || keyParts[0] !== 'training') {
          throw new Error(`Invalid key format: expected 'training/moduleId/uuid-filename', got '${key}'`)
        }
        
        const moduleId = keyParts[1] // training/moduleId/uuid-filename
        console.log('🆔 [confirmUpload] Extracted module ID from key:', moduleId)
        
        // Extract original filename from S3 key (remove UUID prefix)
        // Key format: training/${moduleId}/${uuid}-${filename}
        const fullFilename = keyParts[2] || 'video.mp4'
        // UUID format: 8-4-4-4-12 characters followed by a hyphen
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i
        const match = fullFilename.match(uuidPattern)
        const originalFilename = match ? fullFilename.substring(match[0].length) : fullFilename
        
        console.log('📁 [confirmUpload] Original filename:', originalFilename)
        
        // Create module in database
        if (!result.fileUrl) {
          throw new Error('File URL not found in upload confirmation result')
        }
        
        console.log('💾 [confirmUpload] Creating module in database...')
        const savedModule = await DatabaseService.createModule({
          id: moduleId,
          title: originalFilename.replace(/\.[^/.]+$/, ''), // Remove file extension for title
          filename: originalFilename, // Store original filename only (no UUID prefix)
          videoUrl: result.fileUrl,
          s3Key: key,
          stepsKey: `training/${moduleId}.json`,
          status: 'UPLOADED' as const,
          userId: userId || undefined
        })

        // Start AI processing immediately after module creation
        try {
          console.log(`🚀 [confirmUpload] Starting AI processing for module: ${moduleId}`)
          const { startProcessing } = await import('../services/ai/aiPipeline.js')
          console.log(`📦 [confirmUpload] AI pipeline imported, calling startProcessing...`)
          await startProcessing(moduleId)
          console.log(`✅ [confirmUpload] AI processing started successfully for module: ${moduleId}`)
          console.log(`[PIPELINE] start (moduleId: ${moduleId})`)
        } catch (processingError) {
          console.error(`❌ [confirmUpload] Failed to start AI processing for module: ${moduleId}:`, processingError)
          console.error(`❌ [confirmUpload] Processing error details:`, processingError)
          // Don't fail the upload, just log the error
        }

        console.log(`🎉 [confirmUpload] Upload confirmed and module created successfully!`)
        console.log(`📊 [confirmUpload] Final response data:`, { moduleId: savedModule.id, success: true })
        
        log.info('Upload confirmed and module created', { key, moduleId, userId })
        
        res.json({
          ...result,
          moduleId: savedModule.id,
          success: true
        })
      } else {
        log.warn('Upload confirmation failed', { key, error: result.error, userId })
        res.status(404).json(result)
      }
    } catch (error) {
      log.error('Upload confirmation error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        key: req.body?.key,
        userId: req.body?.userId 
      })
      res.status(500).json({ 
        error: 'Upload confirmation failed',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      })
    }
  },

  /**
   * Handle upload completion (simplified version for frontend)
   */
  async uploadComplete(req: Request, res: Response) {
    try {
      const { moduleId, key, filename, contentType, size } = req.body
      
      console.log(`[UPLOAD] complete (moduleId: ${moduleId}, key: ${key})`)
      
      if (!moduleId || !key) {
        return res.status(400).json({ 
          ok: false, 
          error: 'moduleId and key are required' 
        })
      }

      // Verify the file exists in S3
      const result = await presignedUploadService.confirmUpload(key)
      
      if (!result.success) {
        return res.status(404).json({ 
          ok: false, 
          error: 'File not found in S3' 
        })
      }

      // Start AI processing
      try {
        console.log(`[PIPELINE] start (moduleId: ${moduleId})`)
        const { startProcessing } = await import('../services/ai/aiPipeline.js')
        await startProcessing(moduleId)
      } catch (processingError) {
        console.error(`❌ Failed to start AI processing for module: ${moduleId}:`, processingError)
        // Don't fail the upload, just log the error
      }

      res.json({ 
        ok: true, 
        message: 'Upload completed and processing started' 
      })
      
    } catch (error) {
      console.error('Upload completion error:', error)
      res.status(500).json({ 
        ok: false, 
        error: 'Upload completion failed' 
      })
    }
  },

  /**
   * Get upload status and metadata
   */
  async getUploadStatus(req: Request, res: Response) {
    try {
      const { key } = req.params
      const { userId } = req.query as { userId?: string }
      
      if (!key) {
        return res.status(400).json({ error: 'key is required' })
      }

      log.info('Getting upload status', { key, userId })

      const result = await presignedUploadService.confirmUpload(key)
      
      if (result.success) {
        // Try to get additional metadata if available
        try {
          const module = await DatabaseService.getModule(key)
          if (module) {
            // Create a new result object with module info
            const enhancedResult = {
              ...result,
              module: {
                id: module.id,
                title: module.title,
                status: module.status || 'unknown'
              }
            }
            res.json(enhancedResult)
            return
          }
        } catch (dbError) {
          // Module not found, which is fine for new uploads
          log.debug('No module found for key', { key })
        }
      }

      res.json(result)
    } catch (error) {
      log.error('Get upload status error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        key: req.params?.key,
        userId: req.query?.userId 
      })
      res.status(500).json({ 
        error: 'Failed to get upload status',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      })
    }
  },

  /**
   * Health check endpoint for the upload service
   */
  async healthCheck(req: Request, res: Response) {
    try {
      log.info('Upload service health check requested')
      
      // Test S3 connectivity
      const testResult = await presignedUploadService.confirmUpload('test-key')
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        s3: testResult.success ? 'connected' : 'disconnected',
        version: process.env.npm_package_version || '1.0.0'
      })
    } catch (error) {
      log.error('Health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable'
      })
    }
  }
}
