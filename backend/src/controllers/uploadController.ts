import { Request, Response } from 'express'

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

      // For now, return mock data - add S3 presigned URL generation later
      res.json({
        success: true,
        uploadUrl: `https://mock-s3-url.com/${filename}`,
        key: `uploads/${Date.now()}-${filename}`,
        expiresIn: 3600
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

      // For now, return mock data - add AI processing later
      const mockModuleId = `module_${Date.now()}`
      const mockSteps = [
        { id: 1, title: 'Video uploaded successfully', timestamp: Date.now() },
        { id: 2, title: 'Processing complete', timestamp: Date.now() + 1000 }
      ]

      res.json({
        success: true,
        moduleId: mockModuleId,
        videoUrl,
        steps: mockSteps,
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

      // For now, just return success with mock data - add S3/AI later
      const mockModuleId = `module_${Date.now()}`
      const mockVideoUrl = `https://temp-url.com/${file.originalname}`

      console.log('Upload successful, returning mock data')

      res.json({
        success: true,
        moduleId: mockModuleId,
        videoUrl: mockVideoUrl,
        steps: [{ id: 1, title: 'Processing...', timestamp: Date.now() }],
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' })
    }
  },
}
