import { Request, Response } from 'express'
import { storageService } from '../services/storageService.js'

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
      const moduleId = await storageService.saveModule(moduleData)
      console.log('✅ Module saved:', moduleId)

      const response = {
        success: true,
        moduleId: moduleId,
        videoUrl: videoUrl,
        steps: moduleData.steps,
      }

      console.log('✅ Returning success response:', response)
      res.json(response)

    } catch (error) {
      console.error('💥 Upload controller error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      res.status(500).json({ 
        error: 'Upload failed',
        message: errorMessage,
        stack: errorStack 
      })
    }
  },
}
