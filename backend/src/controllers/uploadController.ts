import { Request, Response } from 'express'

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    try {
      console.log('Upload request received')
      console.log('Headers:', req.headers)
      console.log('File:', req.file)

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      
      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      console.log('File validated successfully:', file.originalname)

      // Return success immediately (no S3, no AI for now)
      const mockModuleId = `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      res.json({
        success: true,
        moduleId: mockModuleId,
        videoUrl: `http://localhost:8000/uploads/${file.originalname}`,
        steps: [
          { id: 1, timestamp: 0, title: 'Introduction', description: 'Getting started', duration: 30 },
          { id: 2, timestamp: 30, title: 'Main content', description: 'Core training', duration: 60 },
          { id: 3, timestamp: 90, title: 'Conclusion', description: 'Wrapping up', duration: 20 }
        ],
      })
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ error: `Upload failed: ${errorMessage}` })
    }
  },
}
