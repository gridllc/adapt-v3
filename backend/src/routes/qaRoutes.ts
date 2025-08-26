import { Router } from 'express'
import { answerQuestion } from '../controllers/aiController.js'

const router = Router()

// Main QA endpoint - using different path to avoid conflict with aiRoutes
router.post('/question', answerQuestion)

export default router 