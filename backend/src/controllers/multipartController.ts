import { Request, Response } from 'express'
import { z } from 'zod'
import { multipartService } from '../services/multipartService.js'

// Validation schemas
const initializeSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  isMobile: z.boolean().optional().default(false)
})

const signPartSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10000)
})

const completeSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z.array(z.object({
    partNumber: z.number().int().min(1).max(10000),
    etag: z.string().min(1)
  })).min(1)
})

const abortSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1)
})

export class MultipartController {
  /**
   * Initialize a multipart upload
   * POST /api/uploads/multipart/init
   */
  async initialize(req: Request, res: Response) {
    try {
      const { filename, contentType, fileSize, isMobile } = initializeSchema.parse(req.body)

      console.log(`🚀 Multipart upload init request:`, {
        filename,
        contentType,
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
        isMobile,
        userAgent: req.headers['user-agent']?.slice(0, 50)
      })

      const result = await multipartService.initializeUpload(filename, contentType, fileSize, isMobile)

      // Also return upload metrics for client optimization
      const metrics = multipartService.getUploadMetrics(fileSize, isMobile)

      res.status(200).json({
        success: true,
        ...result,
        metrics
      })
    } catch (error) {
      console.error('❌ Multipart init error:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        })
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize upload'
      })
    }
  }

  /**
   * Get signed URL for uploading a part
   * POST /api/uploads/multipart/sign-part
   */
  async signPart(req: Request, res: Response) {
    try {
      const { key, uploadId, partNumber } = signPartSchema.parse(req.body)

      console.log(`🔗 Signing part ${partNumber} for upload:`, {
        key,
        uploadId: uploadId.slice(0, 16) + '...',
        partNumber
      })

      const url = await multipartService.getSignedPartUrl(key, uploadId, partNumber)

      res.status(200).json({
        success: true,
        url,
        partNumber
      })
    } catch (error) {
      console.error(`❌ Part signing error:`, error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        })
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign part URL'
      })
    }
  }

  /**
   * Complete multipart upload
   * POST /api/uploads/multipart/complete
   */
  async complete(req: Request, res: Response) {
    try {
      const { key, uploadId, parts } = completeSchema.parse(req.body)

      console.log(`🏁 Completing multipart upload:`, {
        key,
        uploadId: uploadId.slice(0, 16) + '...',
        partCount: parts.length
      })

      const result = await multipartService.completeUpload(key, uploadId, parts)

      res.status(200).json(result)
    } catch (error) {
      console.error('❌ Multipart complete error:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        })
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete upload'
      })
    }
  }

  /**
   * Abort multipart upload
   * POST /api/uploads/multipart/abort
   */
  async abort(req: Request, res: Response) {
    try {
      const { key, uploadId } = abortSchema.parse(req.body)

      console.log(`🗑️ Aborting multipart upload:`, {
        key,
        uploadId: uploadId.slice(0, 16) + '...'
      })

      const result = await multipartService.abortUpload(key, uploadId)

      res.status(200).json(result)
    } catch (error) {
      console.error('❌ Multipart abort error:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        })
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to abort upload'
      })
    }
  }

  /**
   * Get upload metrics and recommendations
   * POST /api/uploads/multipart/metrics
   */
  async getMetrics(req: Request, res: Response) {
    try {
      const { fileSize, isMobile } = z.object({
        fileSize: z.number().positive(),
        isMobile: z.boolean().optional().default(false)
      }).parse(req.body)

      const metrics = multipartService.getUploadMetrics(fileSize, isMobile)

      res.status(200).json({
        success: true,
        metrics
      })
    } catch (error) {
      console.error('❌ Metrics error:', error)
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        })
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get metrics'
      })
    }
  }

  /**
   * Health check endpoint for multipart upload service
   * GET /api/uploads/multipart/health
   */
  async health(req: Request, res: Response) {
    try {
      // Check if S3 is configured
      const { isS3Configured } = await import('../services/s3Uploader.js')
      
      if (!isS3Configured()) {
        return res.status(503).json({
          success: false,
          error: 'S3 not configured',
          service: 'multipart-upload'
        })
      }

      res.status(200).json({
        success: true,
        service: 'multipart-upload',
        status: 'healthy',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Multipart health check failed:', error)
      res.status(503).json({
        success: false,
        error: 'Service unavailable',
        service: 'multipart-upload'
      })
    }
  }
}

// Export singleton instance
export const multipartController = new MultipartController()