import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { uploadRoutes } from './routes/uploadRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import { moduleRoutes } from './routes/moduleRoutes.js'
import videoRoutes from './routes/videoRoutes.js'
import transcriptRoutes from './routes/transcriptRoutes.js'
import stepsRoutes from './routes/stepsRoutes.js'
import clerkWebhookRoutes from './routes/clerkWebhookRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8001

// Security Middleware
app.use(helmet())
// For Vite dev use 3000; adjust for production as needed
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:3006', 'http://localhost:3007', 'http://localhost:3008'], // Use process.env.FRONTEND_URL for production
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

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