import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
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
import { DatabaseService } from './services/prismaService.js'
import { adminRoutes } from './routes/adminRoutes.js'
import { qaRoutes } from './routes/qaRoutes.js'
import { workerRoutes } from './routes/workerRoutes.js'
import { requireAuth, optionalAuth } from './middleware/auth.js'
import { testAuthRoutes } from './routes/testAuth.js'
import { debugRoutes } from './routes/debugRoutes.js'

// Import QStash queue to ensure it's initialized
import './services/qstashQueue.js'

// Import and validate S3 configuration
import { validateS3Config } from './services/s3Uploader.js'


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
  const corsAllowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')  // comma-separated
    : [
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
        'http://localhost:5185',
        'https://adapt-v3-sepia.vercel.app',
        'https://adapt-v3.vercel.app'
      ]

  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || corsAllowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  }
  app.use(cors(corsOptions))

  // Body parsing middleware (increased for larger video uploads)
  app.use(express.json({ limit: '200mb' }))
  app.use(express.urlencoded({ extended: true, limit: '200mb' }))

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
  // Protected Routes (require authentication)
  app.use('/api/upload', requireAuth, uploadRoutes)
  app.use('/api/modules', requireAuth, moduleRoutes)
  
  // Steps routes with auth for generation
  app.use('/api/steps', stepsRoutes) // Individual routes will be protected as needed
  
  // Public Routes (no authentication required)
  app.use('/api/ai', aiRoutes)
  app.use('/api/video-url', videoRoutes)
  app.use('/api/feedback', feedbackRoutes)
  app.use('/api', transcriptRoutes)
  app.use('/api/reprocess', reprocessRoutes)
  app.use('/api/qa', qaRoutes)
  app.use('/api/worker', workerRoutes)
  app.use('/api/share', shareRoutes)
  
  // Admin Routes (protected)
  app.use('/api/admin', requireAuth, adminRoutes)
  
  // Test Routes (for development)
  if (NODE_ENV === 'development') {
    app.use('/api/test-auth', testAuthRoutes)
    app.use('/api/debug', debugRoutes)
  }

  // Status endpoint (database-backed)
  app.get('/api/status/:moduleId', async (req, res) => {
    try {
      const { moduleId } = req.params
      console.log(`🔍 Checking status for module: ${moduleId}`)

      // Fetch module including its latest status
      const module = await DatabaseService.getModule(moduleId)
      if (!module) {
        console.log(`❌ Module not found: ${moduleId}`)
        return res.status(404).json({
          error: 'Module not found',
          moduleId,
          message: 'This module was never created or has been deleted',
          timestamp: new Date().toISOString()
        })
      }

      console.log(`✅ Module found: ${moduleId}, statuses count: ${module.statuses?.length || 0}`)

      // Prisma returns statuses ordered desc; pick first
      const latest = module.statuses?.[0]
      if (!latest) {
        console.log(`⚠️ Module exists but has no status records: ${moduleId}`)
        // Create a default status for modules that exist but have no status
        try {
          await DatabaseService.updateModuleStatus(moduleId, 'processing', 0, 'Status initialized')
          console.log(`✅ Created default status for module: ${moduleId}`)
          
          // Fetch the module again to get the new status
          const updatedModule = await DatabaseService.getModule(moduleId)
          const newLatest = updatedModule?.statuses?.[0]
          
          if (newLatest) {
            return res.json({
              status: newLatest.status,
              progress: newLatest.progress,
              message: newLatest.message,
              moduleId,
              timestamp: new Date().toISOString()
            })
          }
        } catch (statusError) {
          console.error(`❌ Failed to create default status for ${moduleId}:`, statusError)
        }
        
        return res.status(404).json({
          error: 'Module status not found',
          moduleId,
          timestamp: new Date().toISOString()
        })
      }

      console.log(`✅ Returning status for ${moduleId}: ${latest.status} (${latest.progress}%)`)
      return res.json({
        status: latest.status,
        progress: latest.progress,
        message: latest.message,
        moduleId,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ Status endpoint error:', error)
      return res.status(500).json({
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

    // Enhanced health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      console.log('[TEST] Health check requested')
      
      // Database check
      const dbHealth = await DatabaseService.healthCheck()
      console.log('[TEST] Database health:', dbHealth ? '✅ Connected' : '❌ Failed')
      
      // Redis check
      const { redisClient } = await import('./config/database.js')
      let redisHealth = false
      if (redisClient) {
        try {
          await redisClient.set('health:test', 'ok')
          const result = await redisClient.get('health:test')
          redisHealth = result === 'ok'
          console.log('[TEST] Redis health:', redisHealth ? '✅ Ping OK' : '❌ Redis Issue')
        } catch (redisError) {
          console.error('[TEST] Redis health check failed:', redisError)
        }
      } else {
        console.log('[TEST] Redis health: ⚠️ Not configured')
      }
      
      // S3 check
      let s3Health = false
      try {
        const { checkS3Health } = await import('./services/s3Service.js')
        s3Health = await checkS3Health()
        console.log('[TEST] S3 health:', s3Health ? '✅ Accessible' : '❌ S3 Issue')
      } catch (s3Error) {
        console.error('[TEST] S3 health check failed:', s3Error)
      }
      
      const response = {
        postgres: dbHealth ? '✅ Connected' : '❌ Failed',
        s3: s3Health ? '✅ Accessible' : '❌ S3 Issue',
        redis: redisHealth ? '✅ Ping OK' : '❌ Redis Issue',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: Math.floor(process.uptime())
      }
      
      console.log('[TEST] Health check response:', response)
      res.json(response)
      
    } catch (error) {
      console.error('[TEST] Health check error:', error)
      res.status(500).json({ 
        error: 'Health check failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
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

    app.get('/api/test-db', async (req, res) => {
      try {
        const moduleCount = await DatabaseService.getAllModules().then(modules => modules.length)
        const healthCheck = await DatabaseService.healthCheck()
        
        res.json({ 
          message: 'Database test',
          timestamp: new Date().toISOString(),
          environment: NODE_ENV,
          database: {
            health: healthCheck,
            moduleCount,
            status: 'connected'
          }
        })
      } catch (error) {
        res.status(500).json({ 
          message: 'Database test failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
      }
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

     // Debug environment variables (development only)
     app.get('/api/debug/env', (req, res) => {
       res.json({
         message: 'Environment variables (keys only)',
         timestamp: new Date().toISOString(),
         environment: NODE_ENV,
         envKeys: Object.keys(process.env).sort()
       })
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
      console.log(`   📁 Uploads: ${path.resolve(__dirname, '../uploads')}`)
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
    validateS3Config() // Validate S3 configuration
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