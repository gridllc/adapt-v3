simport { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import config from '../config/env.js'

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
      const moduleId = await storageService.saveModule(moduleData)

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
        error: 'Video processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  /**
   * Legacy endpoint for backwards compatibility
   * POST /api/upload
   */
  async uploadVideo(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        })
      }

      const file = req.file
      
      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ 
          success: false,
          error: 'Only video files are allowed' 
        })
      }

      console.log(`📁 Legacy upload: ${file.originalname} (${file.mimetype})`)

      // Upload to storage
      const videoUrl = await storageService.uploadVideo(file)

      // Process with AI
      console.log(`🤖 Processing legacy upload with AI: ${videoUrl}`)
      const moduleData = await aiService.processVideo(videoUrl)

      // Save module
      console.log(`💾 Saving legacy module data`)
      const moduleId = await storageService.saveModule(moduleData)

      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: moduleData.steps,
        message: 'Video uploaded and processed successfully (legacy method)'
      })
    } catch (error) {
      console.error('❌ Legacy upload error:', error)
      res.status(500).json({ 
        success: false,
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },
}
