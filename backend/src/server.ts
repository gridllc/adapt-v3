import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { moduleRoutes } from './routes/moduleRoutes.js'
import { uploadRoutes } from './routes/uploadRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import { stepsRoutes } from './routes/stepsRoutes.js'
import videoRoutes from './routes/videoRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'
import transcriptRoutes from './routes/transcriptRoutes.js'
import reprocessRoutes from './routes/reprocessRoutes.js'
import shareRoutes from './routes/shareRoutes.js'

// Import job queue to ensure it's initialized
import './services/jobQueue.js'

// Load environment variables
dotenv.config()

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Server configuration
const app = express()
const PORT = process.env.PORT || 8000
const NODE_ENV = process.env.NODE_ENV || 'development'

// Environment validation
const validateEnvironment = () => {
  console.log('🔍 Environment Configuration:')
  console.log(`🌍 NODE_ENV: ${NODE_ENV}`)
  console.log(`🚀 PORT: ${PORT}`)
  console.log(`📧 GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET'}`)
  console.log(`🔑 GOOGLE_PRIVATE_KEY: ${process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET'}`)
  console.log(`🏢 GOOGLE_PROJECT_ID: ${process.env.GOOGLE_PROJECT_ID ? 'SET' : 'NOT SET'}`)
  console.log(`🤖 OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`)
  console.log(`🔮 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`)
  
  // Warn about missing critical environment variables
  const missingVars = []
  if (!process.env.OPENAI_API_KEY) missingVars.push('OPENAI_API_KEY')
  if (!process.env.GOOGLE_CLIENT_EMAIL) missingVars.push('GOOGLE_CLIENT_EMAIL')
  if (!process.env.GOOGLE_PRIVATE_KEY) missingVars.push('GOOGLE_PRIVATE_KEY')
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`)
    console.warn('Some AI features may not work properly')
  }
}

// Middleware configuration
const configureMiddleware = () => {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }))

  // CORS configuration
  const corsOptions = {
    origin: process.env.FRONTEND_URL || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:5178',
      'http://localhost:5179',
      'http://localhost:5180',
      'http://localhost:5181',
      'http://localhost:5182',
      'http://localhost:5183',
      'http://localhost:5184',
      'http://localhost:5185'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  }
  app.use(cors(corsOptions))

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ extended: true, limit: '50mb' }))

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`)
    })
    next()
  })
}

// Route configuration
const configureRoutes = () => {
  // API Routes
  app.use('/api/modules', moduleRoutes)
  app.use('/api/upload', uploadRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/steps', stepsRoutes)
  app.use('/api/video-url', videoRoutes)
  app.use('/api/feedback', feedbackRoutes)
  app.use('/api', transcriptRoutes)
  app.use('/api/reprocess', reprocessRoutes)
  
  // Public Share Routes (no auth required)
  app.use('/api/share', shareRoutes)

  // Status endpoint for debugging stuck jobs
  app.get('/api/status/:moduleId', async (req, res) => {
    try {
      const { moduleId } = req.params
      
      // Import status service
      const { getModuleStatus } = await import('./services/statusService.js')
      
      const status = getModuleStatus(moduleId)
      
      if (!status) {
        return res.status(404).json({ 
          error: 'Module status not found',
          moduleId,
          timestamp: new Date().toISOString()
        })
      }
      
      res.json({
        ...status,
        moduleId,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Status endpoint error:', error)
      res.status(500).json({ 
        error: 'Failed to get module status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  })

  // Static file serving for uploads with CORS
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    next()
  }, express.static(path.join(__dirname, '../uploads')))

  // Handle OPTIONS requests for video files
  app.options('/uploads/:filename', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range')
    res.status(200).end()
  })

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      uptime: process.uptime()
    })
  })

  // Test endpoints for development
  if (NODE_ENV === 'development') {
    app.get('/api/test', (req, res) => {
      res.json({ 
        message: 'Backend is working!',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        cors: 'enabled'
      })
    })

    app.get('/api/test-cors', (req, res) => {
      res.json({ 
        message: 'CORS test successful!',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        origin: req.headers.origin || 'unknown'
      })
    })

    app.post('/api/test-rewrite', async (req, res) => {
      try {
        const { text, style = 'polished' } = req.body
        
        if (!text) {
          return res.status(400).json({ error: 'Text is required' })
        }
        
        // Import AI service
        const { aiService } = await import('./services/aiService.js')
        
        // Call AI rewrite
        const rewrittenText = await aiService.rewriteStep(text, style)
        
        res.json({ 
          original: text,
          rewritten: rewrittenText,
          style: style,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('❌ Test rewrite error:', error)
        res.status(500).json({ 
          error: 'Test rewrite failed', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    })

    app.get('/api/test-speech', async (req, res) => {
      try {
        const { audioProcessor } = await import('./services/audioProcessor.js')
        await audioProcessor.ensureSpeechClient()
        res.json({ 
          status: 'success', 
          message: 'Google Cloud Speech client initialized successfully',
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        res.status(500).json({ 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
      }
    })
  }
}

// Error handling middleware
const configureErrorHandling = () => {
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Route not found',
      path: req.path,
      method: req.method
    })
  })

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('❌ Server Error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    })

    // Don't expose internal errors in production
    const errorMessage = NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message

    res.status(err.status || 500).json({ 
      error: errorMessage,
      ...(NODE_ENV === 'development' && { stack: err.stack })
    })
  })
}

// Server startup
const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log('🚀 Server Configuration:')
    console.log(`   📍 Port: ${PORT}`)
    console.log(`   🌍 Environment: ${NODE_ENV}`)
    console.log(`   📁 Uploads: ${path.join(__dirname, '../uploads')}`)
    console.log(`   🔗 URL: http://localhost:${PORT}`)
    
    console.log('\n📚 Available API Endpoints:')
    console.log('   POST /api/upload')
    console.log('   POST /api/ai/chat')
    console.log('   GET  /api/modules')
    console.log('   GET  /api/modules/:id')
    console.log('   GET  /api/modules/:id/steps')
    console.log('   GET  /api/steps/:moduleId')
    console.log('   GET  /api/share/:moduleId')
    console.log('   GET  /api/health')
    
    if (NODE_ENV === 'development') {
      console.log('   GET  /api/test')
      console.log('   GET  /api/test-speech')
    }
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...')
    server.close(() => {
      console.log('✅ Server closed')
      process.exit(0)
    })
  })

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...')
    server.close(() => {
      console.log('✅ Server closed')
      process.exit(0)
    })
  })

  return server
}

// Initialize server
const initializeServer = () => {
  try {
    validateEnvironment()
    configureMiddleware()
    configureRoutes()
    configureErrorHandling()
    return startServer()
  } catch (error) {
    console.error('❌ Failed to initialize server:', error)
    process.exit(1)
  }
}

// Start the server
initializeServer() 