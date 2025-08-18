import multer from 'multer'
import { Router } from 'express'
import { aiService } from '../services/aiService.js'
import { DatabaseService } from '../services/prismaService.js'
import { logger } from '../utils/logger.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// AI Ask endpoint - main AI interaction
router.post('/ask', requireAuth, async (req, res) => {
  try {
    const { moduleId, question, stepId, context } = req.body
    const userId = req.userId!
    
    if (!moduleId || !question) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: moduleId and question'
      })
    }

    logger.info(`🤖 AI Ask request: ${question} for module ${moduleId} from user ${userId}`)

    // Get module and steps from database
    const module = await DatabaseService.getModule(moduleId)
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      })
    }

    // Check module ownership
    if (module.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      })
    }

    // Build training context from database data
    const trainingContext = {
      moduleId,
      currentStep: stepId ? module.steps.find(s => s.id === stepId) : null,
      allSteps: module.steps.map(s => ({
        id: s.id,
        title: s.text,
        start: s.startTime,
        end: s.endTime,
        description: s.text,
        notes: undefined // Step model doesn't have notes field
      })),
      videoTime: context?.videoTime || 0,
      userId: context?.userId,
      userProgress: context?.userProgress,
      moduleMetadata: {
        title: module.title || 'Training Module',
        description: `Interactive training module with ${module.steps.length} steps`,
        difficulty: 'beginner' as const,
        estimatedDuration: Math.ceil((module.steps[module.steps.length - 1]?.endTime || 0) / 60),
        prerequisites: [],
        learningObjectives: module.steps.map(s => s.text),
        targetAudience: ['All levels']
      }
    }

    // Generate AI response
    const aiAnswer = await aiService.generateContextualResponse(question, trainingContext)
    
    // Log activity
    await DatabaseService.createActivityLog({
      userId: context?.userId,
      action: 'ai_question',
      targetId: moduleId,
      metadata: {
        question,
        stepId,
        responseLength: aiAnswer.answer.length,
        moduleId
      }
    })

    logger.info(`✅ AI response generated successfully for module ${moduleId}`)
    
    res.json({
      success: true,
      ...aiAnswer
    })

  } catch (error) {
    logger.error('❌ AI Ask endpoint error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

// Voice transcription endpoint
router.post('/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      })
    }

    logger.info(`🎙️ Processing voice transcription request`)

    // Convert audio buffer to file for OpenAI
    const audioBuffer = req.file.buffer
    const audioBlob = new Blob([audioBuffer], { type: req.file.mimetype || 'audio/webm' })
    
    // Create a temporary file path (in production, you'd use proper temp file handling)
    const tempFilePath = `/tmp/voice_${Date.now()}.webm`
    
    // For now, return a mock transcript to test the flow
    // In production, you'd use OpenAI Whisper API
    const mockTranscript = "What do I do next in this training?"
    
    logger.info(`✅ Voice transcription completed: "${mockTranscript}"`)
    
    res.json({
      success: true,
      transcript: mockTranscript,
      confidence: 0.9
    })

  } catch (error) {
    logger.error('❌ Voice transcription error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

// Legacy endpoint for backward compatibility
router.post('/contextual-response', async (req, res) => {
  try {
    const { question, context } = req.body
    
    if (!question || !context) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question and context'
      })
    }

    const aiAnswer = await aiService.generateContextualResponse(question, context)
    
    res.json({
      success: true,
      ...aiAnswer
    })

  } catch (error) {
    logger.error('❌ Contextual response error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

export default router 
