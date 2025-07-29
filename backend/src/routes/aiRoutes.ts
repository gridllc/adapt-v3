import express from 'express'
import { aiController } from '../controllers/aiController.js'

const router = express.Router()

// Chat endpoint
router.post('/chat', aiController.chat)

// Process video endpoint
router.post('/process-video', aiController.processVideo)

export { router as aiRoutes } 