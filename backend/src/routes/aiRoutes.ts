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
    
    console.log(`✅ AI processing completed for ${moduleId}, generated ${steps.length} steps`)
    
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

// Test AI processing (NEW)
router.get('/test/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const videoUrl = `http://localhost:8000/uploads/${moduleId}.mp4`
    
    console.log(`🧪 Testing AI processing for module: ${moduleId}`)
    
    // Test the AI service directly
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    
    res.json({
      success: true,
      moduleId,
      steps,
      stepCount: steps.length,
      message: 'AI test completed successfully'
    })
  } catch (error) {
    console.error('AI test error:', error)
    res.status(500).json({ error: 'Failed to test AI processing' })
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