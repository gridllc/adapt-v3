import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { DatabaseService } from '../services/prismaService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import config from '../config/env.js'
import crypto from 'crypto'
import { uploadToS3 } from '../services/s3Uploader.js'

export const uploadController = {
  /**
   * Generate presigned URL for direct S3 upload
   * POST /api/upload/presigned-url
   */
  async getPresignedUrl(req: Request, res: Response) {
    try {
      const { filename, contentType } = req.body
      
      if (!filename || !contentType) {
        return res.status(400).json({ 
          error: 'filename and contentType are required' 
        })
      }

      // Validate content type
      if (!contentType.startsWith('video/')) {
        return res.status(400).json({ 
          error: 'Only video files are allowed' 
        })
      }

      // Validate file size (client-side validation, but we can add server-side checks)
      const { fileSize } = req.body
      if (fileSize && fileSize > config.MAX_FILE_SIZE) {
        return res.status(400).json({ 
          error: `File size exceeds maximum allowed size of ${config.MAX_FILE_SIZE / (1024 * 1024)}MB` 
        })
      }

      console.log(`🔗 Generating presigned URL for: ${filename} (${contentType})`)

      const result = await presignedUploadService.generatePresignedUrl(
        filename, 
        contentType
      )
      
      res.json({
        success: true,
        ...result
      })
    } catch (error) {
      console.error('❌ Presigned URL error:', error)
      res.status(500).json({ 
        success: false,
        error: 'Failed to generate upload URL' 
      })
    }
  },

  /**
   * Process uploaded video after S3 upload
   * POST /api/upload/process
   */
  async processVideo(req: Request, res: Response) {
    try {
      const { videoUrl, key } = req.body
      
      if (!videoUrl) {
        return res.status(400).json({ 
          success: false,
          error: 'videoUrl is required' 
        })
      }

      console.log(`🎬 Processing video: ${key}`)

      // Confirm upload exists in S3
      const uploadConfirmation = await presignedUploadService.confirmUpload(key)
      if (!uploadConfirmation.success) {
        return res.status(400).json({ 
          success: false,
          error: 'Video file not found. Please ensure upload completed successfully.' 
        })
      }

      // Process with AI
      console.log(`🤖 Processing video with AI: ${videoUrl}`)
      const moduleData = await aiService.processVideo(videoUrl)

      // Save module
      console.log(`💾 Saving module data`)
      const moduleId = await DatabaseService.createModule({
        id: crypto.randomUUID(),
        title: moduleData.title || 'Video Module',
        filename: 'video.mp4',
        videoUrl: videoUrl,
      })

      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: moduleData.steps,
        message: 'Video processed successfully'
      })
    } catch (error) {
      console.error('❌ Video processing error:', error)
      res.status(500).json({ 
        success: false,
        error: 'Video processing failed' 
      })
    }
  },

  async uploadVideo(req: Request, res: Response) {
    try {
      console.log('Upload request received')
      
      if (!req.file) {
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
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      console.log('Uploading to S3...')
      // Upload to storage
      const videoUrl = await uploadToS3(file.buffer, file.originalname, file.mimetype)
      console.log('S3 upload complete:', videoUrl)

      console.log('Processing with AI...')
      // Process with AI
      const moduleData = await aiService.processVideo(videoUrl)
      console.log('AI processing complete')

      console.log('Saving module...')
      // Save module using DatabaseService
      const moduleId = await DatabaseService.createModule({
        id: crypto.randomUUID(),
        title: moduleData.title || 'Video Module',
        filename: file.originalname,
        videoUrl: videoUrl,
      })
      console.log('Module saved:', moduleId)

      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: moduleData.steps,
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' })
    }
  },


}
