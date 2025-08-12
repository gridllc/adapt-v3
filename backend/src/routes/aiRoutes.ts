import express from 'express'
import { aiService } from '../services/aiService.js'
import { DatabaseService } from '../services/prismaService.js'
import { UserService } from '../services/userService.js'
import { generateEmbedding, logInteractionToVectorDB } from '../utils/vectorUtils.js'
import { getLearningStats } from '../services/qaRecall.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../')

// Initialize OpenAI client
let openai: OpenAI | undefined
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    console.log('✅ OpenAI initialized in aiRoutes')
  }
} catch (error) {
  console.error(`❌ Failed to initialize OpenAI in aiRoutes: ${error instanceof Error ? error.message : 'Unknown error'}`)
}

// Configure multer for audio uploads
const upload = multer({ 
  dest: '/tmp',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
})

const router = express.Router()

/**
 * Enhanced contextual AI response endpoint
 */
router.post('/contextual-response', async (req: any, res: any) => {
  try {
    const { userMessage, currentStep, allSteps, videoTime, moduleId } = req.body

    if (!userMessage) {
      return res.status(400).json({ 
        success: false, 
        error: 'User message is required' 
      })
    }

    console.log(`🤖 Contextual AI request for module ${moduleId}`)
    console.log(`📝 User message: "${userMessage}"`)
    console.log(`🎬 Current step: ${currentStep?.title || 'None'}`)
    console.log(`⏰ Video time: ${videoTime}s`)

    // Generate contextual response using the enhanced AI service with Shared Learning System
    const userId = await UserService.getUserIdFromRequest(req)
    const aiResponse = await aiService.generateContextualResponse(
      userMessage,
      {
        currentStep,
        allSteps,
        videoTime,
        moduleId,
        userId: userId || undefined
      }
    )

    console.log(`✅ AI response generated: ${aiResponse.substring(0, 100)}...`)

    // Log activity with basic information
    await DatabaseService.createActivityLog({
      userId: userId || undefined,
      action: 'AI_QUESTION',
      targetId: moduleId,
      metadata: {
        questionLength: userMessage.length,
        answerLength: aiResponse.length,
        videoTime,
        stepId: currentStep?.id
      }
    })

    res.json({ 
      success: true, 
      answer: aiResponse,
      reused: false,
      similarity: null,
      questionId: null
    })
  } catch (error) {
    console.error('❌ Contextual AI response error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate AI response' 
    })
  }
})

/**
 * Simple AI ask endpoint for the frontend useModuleAsk hook
 */
router.post('/ask', async (req: any, res: any) => {
  try {
    const { moduleId, question } = req.body

    if (!moduleId || !question) {
      return res.status(400).json({ 
        success: false, 
        error: 'Module ID and question are required' 
      })
    }

    console.log(`🤖 AI ask request for module ${moduleId}`)
    console.log(`📝 Question: "${question}"`)

    // Get user ID from request
    const userId = await UserService.getUserIdFromRequest(req)

    // Get module and steps for context
    const module = await DatabaseService.getModule(moduleId)
    if (!module) {
      return res.status(404).json({ 
        success: false, 
        error: 'Module not found' 
      })
    }

    const steps = await DatabaseService.getSteps(moduleId)
    
    // Generate contextual response using the enhanced AI service with Shared Learning System
    const aiResponse = await aiService.generateContextualResponse(
      question,
      {
        currentStep: null,
        allSteps: steps,
        videoTime: 0,
        moduleId,
        userId: userId || undefined
      }
    )

    console.log(`✅ AI response generated: ${aiResponse.substring(0, 100)}...`)

    // Log activity with basic information
    await DatabaseService.createActivityLog({
      userId: userId || undefined,
      action: 'AI_ASK',
      targetId: moduleId,
      metadata: {
        questionLength: question.length,
        answerLength: aiResponse.length
      }
    })

    res.json({ 
      success: true, 
      answer: aiResponse,
      reused: false,
      similarity: null,
      questionId: null
    })
  } catch (error) {
    console.error('❌ AI ask error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate AI response' 
    })
  }
})

// Get Shared AI Learning System statistics
router.get('/learning-stats', async (req, res) => {
  try {
    console.log('📊 Fetching Shared AI Learning System statistics')
    
    const stats = await getLearningStats()
    
    res.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('❌ Failed to get learning stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get learning statistics'
    })
  }
})

// Process video with enhanced AI analysis
router.post('/process-video/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    console.log(`🤖 AI processing request for module: ${moduleId}`)
    
    // Get video file path
    const videoPath = path.join(projectRoot, 'backend', 'uploads', `${moduleId}.mp4`)
    
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`)
      return res.status(404).json({ 
        success: false, 
        error: 'Video file not found',
        moduleId 
      })
    }
    
    console.log(`📹 Processing video: ${videoPath}`)
    
    // Process video with enhanced AI analysis
    const videoData = await aiService.processVideo(`http://localhost:8000/uploads/${moduleId}.mp4`)
    
    console.log(`✅ AI processing completed for module: ${moduleId}`)
    console.log(`📊 Generated ${videoData.steps?.length || 0} steps`)
    
    // Save enhanced steps to file
    const stepsDir = path.join(projectRoot, 'backend', 'src', 'data', 'steps')
    const stepsPath = path.join(stepsDir, `${moduleId}.json`)
    
    console.log(`💾 Saving enhanced steps to: ${stepsPath}`)
    await fs.promises.mkdir(stepsDir, { recursive: true })
    await fs.promises.writeFile(stepsPath, JSON.stringify(videoData.steps, null, 2))
    
    // Return enhanced response with all analysis data
    res.json({
      success: true,
      moduleId,
      title: videoData.title,
      description: videoData.description,
      steps: videoData.steps,
      totalDuration: videoData.totalDuration,
      transcript: videoData.transcript,
      message: 'Enhanced video analysis completed successfully'
    })
  } catch (error) {
    console.error('❌ AI processing error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'AI processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Test enhanced AI processing
router.get('/test/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    console.log(`🧪 Testing enhanced AI processing for module: ${moduleId}`)
    
    const videoPath = path.join(projectRoot, 'backend', 'uploads', `${moduleId}.mp4`)
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Video file not found for testing',
        moduleId 
      })
    }
    
    const videoData = await aiService.processVideo(`http://localhost:8000/uploads/${moduleId}.mp4`)
    
    res.json({
      success: true,
      moduleId,
      testResults: {
        stepsGenerated: videoData.steps?.length || 0,
        transcriptLength: videoData.transcript?.length || 0,
        totalDuration: videoData.totalDuration,
        title: videoData.title,
        description: videoData.description
      }
    })
  } catch (error) {
    console.error('❌ Test error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Enhanced chat with context awareness
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body
    
    console.log(`💬 Enhanced chat request: ${message}`)
    console.log(`📋 Context:`, context)
    
    // Use enhanced AI service for chat
    const response = await aiService.chat(message, context)
    
    res.json({
      success: true,
      message: response,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Chat error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Chat failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Debug transcription route
router.get('/debug-transcribe/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    console.log('⚙️ Starting transcription for', moduleId)
    
    // Test the transcription directly
    const audioPath = path.join(projectRoot, 'backend', 'processed', `${moduleId}_speech.wav`)
    
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Audio file not found', path: audioPath })
    }
    
    console.log('📁 Found audio file:', audioPath)
    const audioFile = await fs.promises.readFile(audioPath)
    console.log('📁 Audio file size:', audioFile.length, 'bytes')
    
    // Test OpenAI transcription
    if (!openai) {
      // Initialize OpenAI if not already done
      try {
        if (process.env.OPENAI_API_KEY) {
          openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          console.log('✅ OpenAI initialized in debug route')
        } else {
          return res.status(500).json({ error: 'OpenAI API key not found' })
        }
      } catch (error) {
        return res.status(500).json({ error: 'Failed to initialize OpenAI' })
      }
    }
    
    console.log('🎤 Testing Whisper transcription...')
    console.log('📁 File size:', audioFile.length, 'bytes')
    
    // Use fs.createReadStream for OpenAI (this is the recommended approach)
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'text'
    })
    
    console.log('✅ Transcription successful:', transcription.length, 'characters')
    
    res.json({
      success: true,
      moduleId,
      transcription: transcription,
      length: transcription.length
    })
  } catch (error) {
    console.error('❌ Transcription debug error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Real-time audio transcription endpoint
router.post('/transcribe', upload.single('audio') as any, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file provided' 
      })
    }

    console.log('🎤 Audio transcription request received')
    console.log(`📁 File: ${req.file.originalname}`)
    console.log(`📊 Size: ${req.file.size} bytes`)

    // Read the audio file
    if (!req.file?.path) {
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file path found' 
      })
    }
    const audioBytes = fs.readFileSync(req.file.path)
    console.log(`📁 Audio file read: ${audioBytes.length} bytes`)

    // Initialize OpenAI if not already done
    if (!openai) {
      try {
        if (process.env.OPENAI_API_KEY) {
          openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          console.log('✅ OpenAI initialized for transcription')
        } else {
          return res.status(500).json({ error: 'OpenAI API key not found' })
        }
      } catch (error) {
        return res.status(500).json({ error: 'Failed to initialize OpenAI' })
      }
    }

    console.log('🎤 Starting Whisper transcription...')
    
    // Use OpenAI Whisper for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
      response_format: 'text'
    })

    // Clean up the temporary file
    if (req.file.path) {
      fs.unlinkSync(req.file.path)
    }

    console.log('✅ Transcription successful:', transcription.length, 'characters')
    console.log('📝 Transcript:', transcription.substring(0, 100) + '...')

    // Log activity
    const userId = await UserService.getUserIdFromRequest(req)
    await DatabaseService.createActivityLog({
      userId: userId || undefined,
      action: 'UPLOAD_AUDIO',
      metadata: { 
        fileSize: req.file.size,
        transcriptLength: transcription.length,
        originalName: req.file.originalname
      }
    })

    res.json({
      success: true,
      transcript: transcription,
      length: transcription.length
    })
  } catch (error) {
    console.error('❌ Transcription error:', error)
    
    // Clean up file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Vector search for similar questions
router.post('/search-similar', async (req, res) => {
  try {
    const { moduleId, question } = req.body

    if (!moduleId || !question) {
      return res.status(400).json({ 
        success: false, 
        error: 'Module ID and question are required' 
      })
    }

    console.log(`🔍 Searching for similar questions in module: ${moduleId}`)
    console.log(`📝 Question: "${question}"`)

    // Generate embedding for the new question
    const embedding = await generateEmbedding(question)

    // Find similar questions
    const similarQuestions = await DatabaseService.findSimilarQuestions(moduleId, embedding, 0.8)

    console.log(`✅ Found ${similarQuestions.length} similar questions`)

    res.json({
      success: true,
      similarQuestions,
      count: similarQuestions.length
    })
  } catch (error) {
    console.error('❌ Vector search error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Vector search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export { router as aiRoutes } 