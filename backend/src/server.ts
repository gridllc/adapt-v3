import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { uploadRoutes } from './routes/uploadRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import { moduleRoutes } from './routes/moduleRoutes.js'
import videoRoutes from './routes/videoRoutes.js'
import transcriptRoutes from './routes/transcriptRoutes.js'
import stepsRoutes from './routes/stepsRoutes.js'
import clerkWebhookRoutes from './routes/clerkWebhookRoutes.js'

dotenv.config()

console.log('Starting server...')
console.log('Environment check:', {
  hasClerk: !!process.env.CLERK_SECRET_KEY,
  hasGemini: !!process.env.GEMINI_API_KEY,
  port: process.env.PORT
})

const app = express()
const PORT = process.env.PORT || 8000

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Security Middleware
app.use(helmet())

// CORS configuration for both development and production
const allowedOrigins: string[] = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
  'http://localhost:3007',
  'http://localhost:3008',
  process.env.FRONTEND_URL // Add production frontend URL
].filter((origin): origin is string => Boolean(origin)) // Remove undefined values and type as string[]

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
console.log('Loading upload routes...')
app.use('/api/upload', uploadRoutes)

console.log('Loading AI routes...')
app.use('/api/ai', aiRoutes)

console.log('Loading module routes...')
app.use('/api/modules', moduleRoutes)

console.log('Loading video routes...')
app.use('/api', videoRoutes)

console.log('Loading transcript routes...')
app.use('/api', transcriptRoutes)

console.log('Loading steps routes...')
app.use('/api', stepsRoutes)

// Temporarily disabled Clerk webhooks for debugging
// console.log('Loading Clerk webhook routes...')
// app.use('/api', express.json({ type: '*/*' }), clerkWebhookRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    environment: {
      hasClerk: !!process.env.CLERK_SECRET_KEY,
      hasGemini: !!process.env.GEMINI_API_KEY,
      port: process.env.PORT
    }
  })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
}) 