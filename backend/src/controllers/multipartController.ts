import { Request, Response } from 'express'
import { multipartService } from '../services/multipartService.js'
import { z } from 'zod'

const InitSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive(),
  isMobile: z.boolean().optional().default(false),
})

const SignPartSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10000),
})

const CompleteSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  parts: z.array(z.object({
    partNumber: z.number().int().min(1),
    etag: z.string().min(1),
  })).min(1),
})

const AbortSchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
})

export const multipartController = {
  async initUpload(req: Request, res: Response) {
    try {
      const { filename, contentType, fileSize, isMobile } = InitSchema.parse(req.body)
      
      // Validate file type
      if (!contentType.startsWith('video/')) {
        return res.status(400).json({ 
          error: 'Only video files are supported' 
        })
      }

      // Initialize multipart upload with device-specific optimization
      const result = await multipartService.initializeUpload(
        filename, 
        contentType,
        fileSize,
        isMobile
      )

      res.json({
        success: true,
        ...result,
        message: 'Multipart upload initialized successfully'
      })
    } catch (error) {
      console.error('Init upload error:', error)
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid request',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      })
    }
  },

  async signPart(req: Request, res: Response) {
    try {
      const { key, uploadId, partNumber } = SignPartSchema.parse(req.body)
      
      const url = await multipartService.getSignedPartUrl(
        key, 
        uploadId, 
        partNumber
      )

      res.json({ 
        success: true,
        url,
        message: `Signed URL generated for part ${partNumber}`
      })
    } catch (error) {
      console.error('Sign part error:', error)
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to sign part',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      })
    }
  },

  async completeUpload(req: Request, res: Response) {
    try {
      const { key, uploadId, parts } = CompleteSchema.parse(req.body)
      
      // Validate parts before completion
      const expectedPartCount = parts.length
      if (!multipartService.validateParts(parts, expectedPartCount)) {
        return res.status(400).json({
          error: 'Invalid parts configuration. Parts must be sequential and complete.'
        })
      }
      
      const result = await multipartService.completeUpload(key, uploadId, parts)
      
      // Here you would typically:
      // 1. Save video metadata to database
      // 2. Trigger AI processing
      // 3. Create training module
      
      const videoUrl = result.location
      
      // For now, return mock module data
      // TODO: Integrate with actual AI processing
      const moduleId = `module_${Date.now()}`
      
      res.json({
        success: true,
        moduleId,
        videoUrl,
        key,
        etag: result.etag,
        message: 'Multipart upload completed successfully'
      })
    } catch (error) {
      console.error('Complete upload error:', error)
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to complete upload',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      })
    }
  },

  async abortUpload(req: Request, res: Response) {
    try {
      const { key, uploadId } = AbortSchema.parse(req.body)
      
      await multipartService.abortUpload(key, uploadId)
      
      res.json({ 
        success: true,
        message: 'Multipart upload aborted successfully'
      })
    } catch (error) {
      console.error('Abort upload error:', error)
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to abort upload',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      })
    }
  },
}

