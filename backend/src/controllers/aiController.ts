import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'

export const aiController = {
  async chat(req: Request, res: Response) {
    try {
      const { message, context } = req.body
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' })
      }

      const response = await aiService.chat(message, context || {})
      
      res.json({ response })
    } catch (error) {
      console.error('Chat error:', error)
      res.status(500).json({ error: 'Chat failed' })
    }
  },

  async processVideo(req: Request, res: Response) {
    try {
      const { videoUrl } = req.body
      
      if (!videoUrl) {
        return res.status(400).json({ error: 'Video URL is required' })
      }

      const result = await aiService.processVideo(videoUrl)
      
      res.json(result)
    } catch (error) {
      console.error('Video processing error:', error)
      res.status(500).json({ error: 'Video processing failed' })
    }
  },
} 
