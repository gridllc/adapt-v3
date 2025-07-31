import express, { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'

const router = express.Router()

// Process existing video with AI
router.post('/process-video/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const videoUrl = `http://localhost:8000/uploads/${moduleId}.mp4`
    
    console.log(`🔄 Processing video for module: ${moduleId}`)
    
    // Generate steps using AI analysis
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    res.json({
      success: true,
      moduleId,
      steps,
      message: 'Video processed successfully'
    })
  } catch (error) {
    console.error('AI processing error:', error)
    res.status(500).json({ error: 'Failed to process video' })
  }
})

// Chat with AI about training
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body
    
    const response = await aiService.chat(message, context)
    
    res.json({
      success: true,
      response
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Failed to process chat' })
  }
})

export { router as aiRoutes } 