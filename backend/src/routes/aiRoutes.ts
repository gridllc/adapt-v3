import express, { Request, Response } from 'express'
import { aiController } from '../controllers/aiController.js'
import { z } from 'zod'
import { askGemini, askOpenAI } from '../services/aiService.js'

const router = express.Router()

const askSchema = z.object({
  moduleId: z.string().min(1),
  question: z.string().min(2),
})

router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { moduleId, question } = askSchema.parse(req.body)
    const context = `You are helping a trainee learn from module "${moduleId}". Answer clearly.`

    try {
      const geminiAnswer = await askGemini(question, context)
      return res.json({ success: true, source: 'gemini', answer: geminiAnswer })
    } catch (geminiError) {
      console.warn('Gemini failed, falling back to OpenAI:', geminiError)
      const openaiAnswer = await askOpenAI(question, context)
      return res.json({ success: true, source: 'openai', answer: openaiAnswer })
    }
  } catch (err: any) {
    console.error('Ask error:', err)
    return res.status(400).json({ error: err.message || 'Invalid request' })
  }
})

// Chat endpoint
router.post('/chat', aiController.chat)

// Process video endpoint
router.post('/process-video', aiController.processVideo)

export { router as aiRoutes } 