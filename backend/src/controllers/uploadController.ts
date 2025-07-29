import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      
      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      // Upload to storage
      const videoUrl = await storageService.uploadVideo(file)

      // Process with AI
      const moduleData = await aiService.processVideo(videoUrl)

      // Save module
      const moduleId = await storageService.saveModule(moduleData)

      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: moduleData.steps,
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: 'Upload failed' })
    }
  },
} 