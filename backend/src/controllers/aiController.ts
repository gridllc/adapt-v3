import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { generateStepsFromVideo } from '../services/ai/index.js'

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
      const { moduleId } = req.body
      
      if (!moduleId) {
        return res.status(400).json({ error: 'Module ID is required' })
      }

      const result = await generateStepsFromVideo(moduleId)
      
      res.json(result)
    } catch (error) {
      console.error('Video processing error:', error)
      res.status(500).json({ error: 'Video processing failed' })
    }
  },
} 
