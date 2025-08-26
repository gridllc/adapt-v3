import { Router } from 'express'
import { answerQuestion, qaAsk } from '../controllers/aiController.js'
import { relatedQuestions } from '../controllers/qaController.js'

const router = Router()

// Main QA endpoint - using different path to avoid conflict with aiRoutes
router.post('/question', answerQuestion)

// New RAG-based QA endpoints
router.post('/ask', qaAsk)             // POST /api/qa/ask
router.get('/related', relatedQuestions) // GET /api/qa/related?moduleId=...&q=...

export default router 