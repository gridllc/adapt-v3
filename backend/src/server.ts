import 'dotenv/config'
import { ensureEnv } from './config/env.js'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { rateLimiters, securityHeaders, sanitizeInput } from './middleware/security.js'
import { logger, addRequestId, httpLogging } from './utils/structuredLogger.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { moduleRoutes } from './routes/moduleRoutes.js'

import { uploadRoutes } from './routes/uploadRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import { stepsRoutes } from './routes/stepsRoutes.js'
import { videoRoutes } from './routes/videoRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'
import transcriptRoutes from './routes/transcriptRoutes.js'
import reprocessRoutes from './routes/reprocessRoutes.js'
import shareRoutes from './routes/shareRoutes.js'
import { DatabaseService } from './services/prismaService.js'
import { prisma } from './config/database.js'
import { adminRoutes } from './routes/adminRoutes.js'
import { qaRoutes } from './routes/qaRoutes.js'
import { workerRoutes } from './routes/workerRoutes.js'
import { requireAuth, optionalAuth } from './middleware/auth.js'
import { testAuthRoutes } from './routes/testAuth.js'
import debugRoutes from './routes/debugRoutes.js'
import { requestLogger } from './middleware/requestLogger.js'
import healthRoutes from './routes/healthRoutes.js'
import storageRoutes from './routes/storageRoutes.js'

// Import QStash queue to ensure it's initialized
import './services/qstashQueue.js'

// Import and validate S3 configuration
import { validateS3Config } from './services/s3Uploader.js'

// Ensure critical environment variables are set
ensureEnv()

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Server configuration
const app = express()

// Exact origins that are allowed to call your API
const ALLOW = new Set<string>([
  'https://adaptord.com',
  'https://app.adaptord.com',
  'http://localhost:5173',
])

// Global CORS shim — runs before everything else
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined

  if (origin && ALLOW.has(origin)) {
    // Required for credentials mode
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    // Methods allowed
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD')

    // Echo back whatever headers the browser asked to send in preflight
    const reqHeaders = (req.headers['access-control-request-headers'] as string) || ''
    res.setHeader(
      'Access-Control-Allow-Headers',
      reqHeaders || 'Authorization, Content-Type, Cache-Control, Pragma, X-Requested-With'
    )

    // Useful when reading lengths/ETag on GETs
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length, ETag')
  }

  // Handle preflight immediately
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Health (so probes don't 502)
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))
app.head('/api/health', (_req, res) => res.sendStatus(200))

// Use PORT env var if provided (Render sets PORT=10000), fallback to 8000 for local dev
const PORT = process.env.PORT || 8000
const NODE_ENV = process.env.NODE_ENV || 'development'

// Trust proxy for production (Render sets X-Forwarded-For)
if (NODE_ENV === 'production') {
  app.set('trust proxy', true)
  console.log('🔒 Trust proxy enabled for production')
}

// Environment validation
const validateEnvironment = () => {
  console.log('🔍 Environment Configuration:')
  console.log(`🌍 NODE_ENV: ${NODE_ENV}`)
  console.log(`🚀 PORT: ${PORT}`)
  console.log(`🗄️ DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
  console.log(`📧 GOOGLE_CLIENT_EMAIL: ${process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET'}`)
  console.log(`🔑 GOOGLE_PRIVATE_KEY: ${process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET'}`)
  console.log(`🏢 GOOGLE_PROJECT_ID: ${process.env.GOOGLE_PROJECT_ID ? 'SET' : 'NOT SET'}`)
  console.log(`🤖 OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`)
  console.log(`🔮 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`)
  
  // Ensure temp directory exists for S3-first pipeline
  const tempDir = process.env.TEMP_DIR || '/app/temp'
  if (!fs.existsSync(tempDir)) {
    console.log(`📁 Creating temp directory: ${tempDir}`)
    fs.mkdirSync(tempDir, { recursive: true })
  }
  console.log(`📁 Temp directory ready: ${tempDir}`)
  
  // Check for critical environment variables
  const missingCritical = []
  const missingOptional = []
  
  // Critical for basic operation
  if (!process.env.DATABASE_URL) missingCritical.push('DATABASE_URL')
  
  // Important for AI features
  if (!process.env.OPENAI_API_KEY) missingOptional.push('OPENAI_API_KEY')
  if (!process.env.GOOGLE_CLIENT_EMAIL) missingOptional.push('GOOGLE_CLIENT_EMAIL')
  if (!process.env.GOOGLE_PRIVATE_KEY) missingOptional.push('GOOGLE_PRIVATE_KEY')
  
  if (missingCritical.length > 0) {
    console.error(`❌ CRITICAL: Missing environment variables: ${missingCritical.join(', ')}`)
    console.error('Application cannot start without these variables')
    throw new Error(`Missing critical environment variables: ${missingCritical.join(', ')}`)
  }
  
  if (missingOptional.length > 0) {
    console.warn(`⚠️ Missing optional environment variables: ${missingOptional.join(', ')}`)
    console.warn('Some AI features may not work properly')
  }
}

// Middleware configuration
const configureMiddleware = () => {
  // Request ID and logging
  app.use(addRequestId)
  app.use(httpLogging)

  // Security middleware - disable CSP for API
  app.use(helmet({
    contentSecurityPolicy: false, // API only; let the frontend own CSP
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))
  
  // Additional security headers
  app.use(securityHeaders)
  
  // Input sanitization
  app.use(sanitizeInput)

  // Note: CORS is now handled manually at the top of the app
  // Rate limiting is applied at the route level for better control

  // Body parsing middleware (reduced since we're not receiving file bytes anymore)
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // Request logging middleware with traceId
  app.use(requestLogger)
}

// Route configuration
const configureRoutes = () => {
  // Apply general rate limiting to all API routes
  app.use('/api/', rateLimiters.general)
  
  // Upload Routes (with stricter rate limiting)
  app.use('/api/upload', rateLimiters.upload, uploadRoutes)
  
  // AI processing routes (with strictest rate limiting)
  app.use('/api/ai', rateLimiters.aiProcessing, aiRoutes)
  
  // Public Routes (with general rate limiting)
  app.use('/api', healthRoutes)  // Mounts /api/health
  
  app.use('/api/video', videoRoutes)  // Changed from /api/video-url to /api/video
  app.use('/api/feedback', feedbackRoutes)
  app.use('/api', transcriptRoutes)
  app.use('/api/steps', stepsRoutes)  // ✅ ADD THIS - Fixes 404 for /api/steps/:moduleId
  app.use('/api/reprocess', reprocessRoutes)
  app.use('/api/qa', qaRoutes)
  app.use('/api/worker', workerRoutes)
  app.use('/api/share', shareRoutes)
  app.use('/api/storage', storageRoutes)
  
  // QStash webhook endpoint for processing video steps
  app.post('/api/process-steps', async (req, res) => {
    try {
      console.log('📩 Incoming QStash request:', req.headers, req.body)
      
      const { moduleId, videoUrl } = req.body

      if (!moduleId || !videoUrl) {
        console.error('❌ Missing required fields:', { moduleId, videoUrl })
        return res.status(400).json({ error: 'Missing moduleId or videoUrl' })
      }

      console.log(`📥 QStash webhook received for moduleId=${moduleId}`)
      // Use the new pipeline directly
      const { startProcessing } = await import('./services/ai/pipeline.js')
      await startProcessing(moduleId)
      res.status(200).json({ success: true })
    } catch (err) {
      console.error('❌ QStash processing failed:', err)
      res.status(500).json({ error: 'Processing failed' })
    }
  })
  
  // Module Routes (temporarily optional for debugging - change back to requireAuth after testing)
  app.use('/api/modules', optionalAuth, moduleRoutes)
  
  // Admin Routes (protected)
  app.use('/api/admin', requireAuth, adminRoutes)
  
  // Test Routes (for development)
  if (NODE_ENV === 'development') {
    app.use('/api/test-auth', testAuthRoutes)
    app.use('/api/debug', debugRoutes)
  }

  // QStash worker endpoint for processing modules
  app.post('/internal/qstash/process/:moduleId', async (req, res) => {
    const { moduleId } = req.params
    console.log('🧵 Worker start', { moduleId })
    
    try {
      // Import the pipeline function dynamically to avoid circular imports
      const { startProcessing } = await import('./services/ai/pipeline.js')
      await startProcessing(moduleId)
      console.log('🧵 Worker done', { moduleId })
      res.json({ ok: true })
    } catch (e: any) {
      console.error('🧵 Worker failed', { moduleId, error: e?.message, stack: e?.stack })
      res.status(500).json({ ok: false, error: String(e?.message ?? e) })
    }
  })

  // Root endpoint - API status
  app.get('/', (req, res) => {
    res.json({
      status: 'Backend running ✅',
      version: 'v3',
      message: 'Adapt Video Training Platform API',
      description: 'This is the backend API server. The frontend is hosted separately.',
      endpoints: {
        health: '/api/health',
        uploads: '/api/upload',
        upload: '/api/upload',
        modules: '/api/modules',
        ai: '/api/ai',
        steps: '/api/steps/:moduleId',  // ✅ ADD THIS
        status: '/api/status/:moduleId'
      },
      frontend: 'https://adapt-v3.vercel.app',
      timestamp: new Date().toISOString()
    })
  })

  // API-only mode - redirect non-API routes to frontend
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      return res.redirect('https://adapt-v3.vercel.app')
    }
    // Let the 404 handler deal with unknown API routes
    res.status(404).json({
      error: 'Route not found',
      path: req.path,
      method: req.method,
      message: 'This is an API-only server. Visit https://adapt-v3.vercel.app for the frontend.'
    })
  })

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

      console.log(`✅ Module found: ${moduleId}, status: ${module.status}`)

      // Module now has direct status field
      if (!module.status) {
        console.log(`⚠️ Module exists but has no status: ${moduleId}`)
        // Create a default status for modules that exist but have no status
        try {
          await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Status initialized')
          console.log(`✅ Created default status for module: ${moduleId}`)
          
          // Fetch the module again to get the new status
          const updatedModule = await DatabaseService.getModule(moduleId)
          
          if (updatedModule?.status) {
            return res.json({
              status: updatedModule.status,
              progress: updatedModule.progress,
              message: 'Status initialized',
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

      console.log(`✅ Returning status for ${moduleId}: ${module.status} (${module.progress}%)`)
      return res.json({
        status: module.status,
        progress: module.progress,
        message: 'Current status',
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
         // Initialize AI services
      console.log('🤖 Initializing AI services...')
      try {
        // Initialize transcription service
        console.log('🎤 Initializing transcription service...')
        // Transcription service is now initialized in the pipeline when needed
        console.log('✅ Transcription service ready')
      } catch (error) {
        console.error('❌ Failed to initialize transcription service:', error)
      }
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
    // Set CORS headers even for 404s
    const origin = req.headers.origin as string | undefined
    if (origin && ALLOW.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    
    res.status(404).json({ 
      error: 'Route not found',
      path: req.path,
      method: req.method
    })
  })

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Set CORS headers even for errors
    const origin = req.headers.origin as string | undefined
    if (origin && ALLOW.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    
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
    const server = app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`   🌍 Environment: ${NODE_ENV}`)
      console.log(`   🔗 URL: http://localhost:${PORT}`)
    
    console.log('\n📚 Available API Endpoints:')
      console.log('   POST /api/upload/init')
      console.log('   POST /api/upload/complete')
      console.log('   POST /api/upload/presigned-url (alias)')
      console.log('   POST /api/upload/process (alias)')
      console.log('   POST /api/ai/chat')
      console.log('   GET  /api/modules')
      console.log('   GET  /api/modules/:id')
      console.log('   GET  /api/modules/:id/steps')
      console.log('   GET  /api/steps/:moduleId')
      console.log('   GET  /api/video/:moduleId/play')
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

// Test database connection with retry
const testDatabaseConnection = async () => {
  const maxAttempts = 5
  let attempt = 1
  
  while (attempt <= maxAttempts) {
    try {
      console.log(`🔍 Testing database connection (attempt ${attempt}/${maxAttempts})...`)
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Database connection successful')
      return true
    } catch (error) {
      console.log(`❌ Database connection failed (attempt ${attempt}/${maxAttempts}):`, error instanceof Error ? error.message : 'Unknown error')
      
      if (attempt === maxAttempts) {
        console.log('⚠️ All database connection attempts failed. Starting server anyway...')
        return false
      }
      
      console.log('⏳ Waiting 10 seconds before retry...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      attempt++
    }
  }
  return false
}

// Initialize server
const initializeServer = async () => {
  try {
    validateEnvironment()
    validateS3Config() // Validate S3 configuration
    
    // Test database connection (but don't fail if it's not available)
    await testDatabaseConnection()
    
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
initializeServer().catch(error => {
  console.error('❌ Failed to start server:', error)
  process.exit(1)
})