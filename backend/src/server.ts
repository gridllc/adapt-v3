import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { moduleRoutes } from './routes/moduleRoutes.js'
import { uploadRoutes } from './routes/uploadRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import stepsRoutes from './routes/stepsRoutes.js'
import videoRoutes from './routes/videoRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'

// Load environment variables from .env file
dotenv.config()

// Debug: Check if environment variables are loaded
console.log('🔍 Environment Variables Check:')
console.log('📧 GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET')
console.log('🔑 GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET')
console.log('🏢 GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID ? 'SET' : 'NOT SET')
console.log('🤖 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET')
console.log('🔮 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8000

// Basic middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Essential API routes
app.use('/api/modules', moduleRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/steps', stepsRoutes)
app.use('/api/video-url', videoRoutes)
app.use('/api/feedback', feedbackRoutes)

// Add CORS headers for video files
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
}, express.static('C:/Users/pgrif/AI_Projects/adapt-v3/backend/uploads'))

// Handle OPTIONS requests for video files
app.options('/uploads/:filename', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range')
  res.status(200).end()
})

// 🧪 Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Test Google Cloud Speech initialization
app.get('/api/test-speech', async (_req, res) => {
  try {
    const { audioProcessor } = await import('./services/audioProcessor.js')
    await audioProcessor.ensureSpeechClient()
    res.json({ 
      status: 'success', 
      message: 'Google Cloud Speech client initialized successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Test endpoint
app.get('/api/test', (_req, res) => {
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📁 Video files served from: ${path.join(__dirname, '../../uploads')}`)
}) 