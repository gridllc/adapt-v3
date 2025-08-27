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
      
      log.info('Presigned URL generated successfully', { 
        filename, 
        key: result.key,
        moduleId,
        userId 
      })
      
      res.json({
        success: true,
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

  // Removed: processVideo, confirmUpload, uploadComplete methods
  // These are dead code - the frontend now uses:
  // 1. /api/presigned-upload/presigned-url (this controller)
  // 2. /api/upload/complete (uploadController)

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
