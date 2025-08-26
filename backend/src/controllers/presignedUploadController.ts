import { Request, Response } from 'express'
import { generatePresignedUrl, generatePlaybackUrl } from '../services/presignedUploadService.js'
import { prisma } from '../config/database.js'

export const presignedUploadController = {
  /**
   * Generate a presigned URL for direct S3 upload
   */
  async getPresignedUrl(req: Request, res: Response) {
    try {
      const { filename, contentType } = req.body as { filename: string; contentType: string }
      
      // Validate required fields
      if (!filename || !contentType) {
        console.warn('Presigned URL request missing required fields', { 
          filename: !!filename, 
          contentType: !!contentType
        })
        return res.status(400).json({ 
          error: 'filename and contentType are required' 
        })
      }

      // Validate file type
      if (!contentType.startsWith('video/')) {
        console.warn('Invalid content type for presigned URL', { contentType })
        return res.status(400).json({ 
          error: 'Only video files are allowed' 
        })
      }

      // Validate filename
      if (filename.length > 255) {
        console.warn('Filename too long', { filenameLength: filename.length })
        return res.status(400).json({ 
          error: 'Filename must be less than 255 characters' 
        })
      }

      // Get user ID from auth (Clerk middleware should populate this)
      const userId = (req as any).auth?.userId ?? null

      console.log('Generating presigned URL', { 
        filename, 
        contentType, 
        userId 
      })

      // Create Module record first
      const module = await prisma.module.create({
        data: {
          title: filename.replace(/\.[^.]+$/, ''),
          filename: filename,
          videoUrl: '', // Will be set after upload
          status: 'UPLOADED',
          userId
        }
      })

      const moduleId = module.id

      // Generate presigned URL with safe key and exact Content-Type
      const result = await generatePresignedUrl(filename, contentType, moduleId, userId)
      
      console.log('[UPLOAD] presign', { moduleId, key: result.key, userId })
      
      console.log('Presigned URL generated successfully', { 
        filename, 
        key: result.key,
        moduleId,
        userId 
      })
      
      res.json({
        success: true,
        url: result.url, // Changed from presignedUrl to url
        key: result.key,
        moduleId: module.id,
        expiresIn: 600, // 10 minutes
        maxFileSize: 500 * 1024 * 1024 // 500MB limit
      })
    } catch (error) {
      console.error('Presigned URL generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      res.status(500).json({ 
        error: 'Failed to generate upload URL',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      })
    }
  },

  /**
   * Generate playback URL for uploaded video
   */
  async getPlaybackUrl(req: Request, res: Response) {
    try {
      const { key } = req.body as { key: string }
      
      if (!key) {
        return res.status(400).json({ error: 'key is required' })
      }

      const playbackUrl = await generatePlaybackUrl(key)
      
      res.json({
        success: true,
        playbackUrl,
        key
      })
    } catch (error) {
      console.error('Playback URL generation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        key: req.body?.key
      })
      res.status(500).json({ 
        error: 'Failed to generate playback URL'
      })
    }
  }
}
