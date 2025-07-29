import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { uploadRoutes } from './routes/uploadRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import { moduleRoutes } from './routes/moduleRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Routes
app.use('/api/upload', uploadRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/modules', moduleRoutes)

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