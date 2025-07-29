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
app.use('/api/upload', uploadRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/modules', moduleRoutes)
app.use('/api', videoRoutes)
app.use('/api', transcriptRoutes)
app.use('/api', stepsRoutes)
app.use('/api', express.json({ type: '*/*' }), clerkWebhookRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
}) 