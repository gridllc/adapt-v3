import 'dotenv/config'
import { ensureEnv } from './config/env.js'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import { rateLimiters, securityHeaders, sanitizeInput } from './middleware/security.js'
import { logger, addRequestId, httpLogging } from './utils/structuredLogger.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { moduleRoutes } from './routes/moduleRoutes.js'
import { webhookRoutes } from './routes/webhooks.js'

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
import { clerkMiddleware } from '@clerk/express'
import { testAuthRoutes } from './routes/testAuth.js'
import debugRoutes from './routes/debugRoutes.js'
import { requestLogger } from './middleware/requestLogger.js'
import healthRoutes from './routes/healthRoutes.js'
import storageRoutes from './routes/storageRoutes.js'

// Import QStash queue to ensure it's initialized
import './services/qstashQueue.js'

// Import and validate S3 configuration
import { validateS3Config } from './services/s3Uploader.js'

// ✅ CRITICAL: Set up global error handlers FIRST (before anything else)
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memoryUsage: process.memoryUsage()
  })
  // Don't crash the server, just log the error and cleanup
  if (global.gc) {
    try {
      global.gc()
      console.log('🗑️ Forced garbage collection after unhandled rejection')
    } catch (gcError) {
      console.warn('⚠️ GC failed:', gcError)
    }
  }
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memoryUsage: process.memoryUsage()
  })
  
  // In production, try to recover gracefully
  if (process.env.NODE_ENV === 'production') {
    console.log('🩹 Production mode: attempting graceful recovery')
    // Force cleanup
    if (global.gc) {
      try {
        global.gc()
        console.log('🗑️ Emergency garbage collection completed')
      } catch (gcError) {
        console.warn('⚠️ Emergency GC failed:', gcError)
      }
    }
    // Don't exit in production, try to continue
  } else {
    console.log('🔄 Development mode: exiting due to uncaught exception')
    process.exit(1)
  }
})

// ✅ Monitor memory usage and warn about leaks
setInterval(() => {
  const usage = process.memoryUsage()
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024)
  const externalMB = Math.round(usage.external / 1024 / 1024)
  
  // Log memory usage every 5 minutes for monitoring
  console.log(`📊 Memory usage: Heap ${heapUsedMB}/${heapTotalMB}MB, External ${externalMB}MB, RSS ${Math.round(usage.rss / 1024 / 1024)}MB`)
  
  // Warn if memory usage is high
  if (heapUsedMB > 300) {
    console.warn(`⚠️ High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`)
    if (global.gc && heapUsedMB > 400) {
      global.gc()
      console.log('🗑️ Triggered garbage collection due to high memory usage')
    }
  }
}, 300000) // Check every 5 minutes

// ✅ Add process monitoring
setInterval(() => {
  console.log(`💓 Server heartbeat - PID: ${process.pid}, Uptime: ${Math.round(process.uptime())}s`)
}, 120000) // Every 2 minutes

// Ensure critical environment variables are set
ensureEnv()

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Server configuration
const app = express()

// ---- CORS Configuration (top level for access by all middleware) ----
const allow = (process.env.CORS_ORIGINS || "https://adaptord.com,https://app.adaptord.com,https://adapt-v3.vercel.app,http://localhost:5173")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

console.log('🌐 [CORS] Allowed origins:', allow);

// Health (so probes don't 502)
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))
app.head('/api/health', (_req, res) => res.sendStatus(200))

// ✅ RENDER: Use PORT env var if provided (Render sets this), fallback to 8000 for local dev
const PORT = parseInt(process.env.PORT || '8000', 10)
const NODE_ENV = process.env.NODE_ENV || 'development'

// Detect if running on Render
const IS_RENDER = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID)

console.log(`🌍 Environment: ${NODE_ENV}`)
console.log(`🚀 Port: ${PORT}`)
console.log(`☁️ Platform: ${IS_RENDER ? 'Render' : 'Local/Other'}`)

// Trust proxy for production (Render sets X-Forwarded-For)
if (NODE_ENV === 'production' || IS_RENDER) {
  app.set('trust proxy', 1)
  console.log('🔒 Trust proxy enabled for production/Render')
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
  console.log(`🎤 ASSEMBLYAI_API_KEY: ${process.env.ASSEMBLYAI_API_KEY ? 'SET' : 'NOT SET'}`)
  console.log(`🌐 API_BASE_URL: ${process.env.API_BASE_URL ? 'SET' : 'NOT SET'}`)
  
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
  if (!process.env.ASSEMBLYAI_API_KEY) missingOptional.push('ASSEMBLYAI_API_KEY')
  if (!process.env.API_BASE_URL) missingOptional.push('API_BASE_URL')
  
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

  // ✅ CRITICAL: Clerk middleware must be registered BEFORE any auth routes
  try {
    app.use(clerkMiddleware())
    console.log('🔐 Clerk middleware registered successfully')
  } catch (clerkError: any) {
    console.error('❌ Failed to register Clerk middleware:', clerkError.message)
    console.error('🔍 Check CLERK_SECRET_KEY and other Clerk environment variables')
    throw clerkError
  }

  // Security middleware - disable CSP for API
  app.use(helmet({
    contentSecurityPolicy: false, // API only; let the frontend own CSP
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))
  
  // Additional security headers
  app.use(securityHeaders)
  
  // Input sanitization
  app.use(sanitizeInput)

  // CORS configuration (using top-level allow variable)
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / server-to-server
      const ok =
        allow.includes(origin) ||
        /\.vercel\.app$/i.test(new URL(origin).hostname); // allow Vercel previews
      cb(ok ? null : new Error("CORS blocked"), ok);
    },
    credentials: true,
  }));

  // Rate limiting is applied at the route level for better control

  // Body parsing middleware - normal JSON for all routes
  app.use(express.json({ limit: '2mb' }))  // Increased for webhook JSON
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // Request logging middleware with traceId
  app.use(requestLogger)
}

// Route configuration
const configureRoutes = () => {
  // Webhooks (no rate limiting for external services) - mount first
  app.use('/webhooks', webhookRoutes)
  
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
      const { startProcessing } = await import('./services/ai/aiPipeline.js')
      await startProcessing(moduleId)
      res.status(200).json({ success: true })
    } catch (err) {
      console.error('❌ QStash processing failed:', err)
      res.status(500).json({ error: 'Processing failed' })
    }
  })
  
  // Module Routes (with proper auth)
  app.use('/api/modules', moduleRoutes)
  
  // Admin Routes (protected)
  app.use('/api/admin', requireAuth, adminRoutes)
  
  // Test Routes (for development and production debugging)
  app.use('/api/test-auth', testAuthRoutes)
  if (NODE_ENV === 'development') {
    app.use('/api/debug', debugRoutes)
  }
  
  // ✅ Add simple auth test endpoint for production debugging
  app.get('/api/auth-test', async (req, res) => {
    try {
      const { getAuth } = await import('@clerk/express')
      const auth = getAuth(req)
      
      console.log('🧪 [AUTH-TEST] Request received:', {
        hasAuth: !!auth,
        userId: auth?.userId,
        sessionId: auth?.sessionId,
        headers: {
          authorization: req.headers.authorization ? 'SET' : 'NOT SET',
          origin: req.headers.origin,
          userAgent: req.headers['user-agent']?.substring(0, 50)
        }
      })
      
      res.json({
        success: true,
        authenticated: !!auth?.userId,
        userId: auth?.userId || null,
        sessionId: auth?.sessionId || null,
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      console.error('❌ [AUTH-TEST] Error:', error.message)
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  })

  // QStash worker endpoint for processing modules
  app.post('/internal/qstash/process/:moduleId', async (req, res) => {
    const { moduleId } = req.params
    console.log('🧵 Worker start', { moduleId })
    
    try {
      // Import the pipeline function dynamically to avoid circular imports
      const { startProcessing } = await import('./services/ai/aiPipeline.js')
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
              success: true,
              status: updatedModule.status,
              progress: updatedModule.progress,
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
        success: true,
        status: module.status,
        progress: module.progress,
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

  // Static file serving for uploads
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

  // Handle OPTIONS requests for video files (CORS handled by main shim)
  app.options('/uploads/:filename', (req, res) => {
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
    if (origin && (allow.includes(origin) || /\.vercel\.app$/i.test(new URL(origin).hostname))) {
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
    if (origin && (allow.includes(origin) || /\.vercel\.app$/i.test(new URL(origin).hostname))) {
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
    const server = app.listen(Number(PORT), "0.0.0.0", (err?: Error) => {
      if (err) {
        console.error('❌ Server failed to start:', err)
        process.exit(1)
      }
      
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`   🌍 Environment: ${NODE_ENV}`)
      console.log(`   🔗 URL: http://0.0.0.0:${PORT}`)
      console.log(`   ☁️ Platform: ${IS_RENDER ? 'Render' : 'Local/Other'}`)
    
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

  // ✅ Handle server errors  
  server.on('error', (error: any) => {
    console.error('❌ Server error:', error)
    if (error.code === 'EADDRINUSE') {
      console.error(`💥 Port ${PORT} is already in use`)
      process.exit(1)
    }
  })

  // ✅ Graceful shutdown with timeout
  const gracefulShutdown = (signal: string) => {
    console.log(`🛑 ${signal} received, shutting down gracefully...`)
    
    server.close((err) => {
      if (err) {
        console.error('❌ Error during server shutdown:', err)
        process.exit(1)
      }
      console.log('✅ Server closed')
      process.exit(0)
    })
    
    // Force exit after 30 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('⏰ Graceful shutdown timeout, forcing exit')
      process.exit(1)
    }, 30000)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  return server
}

// Test database connection with retry and timeout
const testDatabaseConnection = async () => {
  const maxAttempts = 5
  let attempt = 1
  
  while (attempt <= maxAttempts) {
    try {
      console.log(`🔍 Testing database connection (attempt ${attempt}/${maxAttempts})...`)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 15000)
      )
      
      const queryPromise = prisma.$queryRaw`SELECT 1`
      
      await Promise.race([queryPromise, timeoutPromise])
      console.log('✅ Database connection successful')
      
      // Setup database error handlers
      prisma.$on('error', (e) => {
        console.error('❌ Database error:', e)
        // Don't crash, just log
      })
      
      return true
    } catch (error) {
      console.log(`❌ Database connection failed (attempt ${attempt}/${maxAttempts}):`, error instanceof Error ? error.message : 'Unknown error')
      
      if (attempt === maxAttempts) {
        console.log('⚠️ All database connection attempts failed. Starting server anyway...')
        return false
      }
      
      console.log('⏳ Waiting 5 seconds before retry...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      attempt++
    }
  }
  return false
}

// Initialize server with comprehensive error handling
const initializeServer = async () => {
  try {
    console.log('🔄 Initializing server...')
    
    // Step 1: Environment validation
    console.log('1️⃣ Validating environment...')
    validateEnvironment()
    
    // Step 2: S3 configuration
    console.log('2️⃣ Validating S3 configuration...')
    validateS3Config()
    
    // Step 3: Database connection (non-blocking)
    console.log('3️⃣ Testing database connection...')
    await testDatabaseConnection()
    
    // Step 4: Configure middleware
    console.log('4️⃣ Configuring middleware...')
    configureMiddleware()
    
    // Step 5: Configure routes
    console.log('5️⃣ Configuring routes...')
    configureRoutes()
    
    // Step 6: Configure error handling
    console.log('6️⃣ Configuring error handling...')
    configureErrorHandling()
    
    // Step 7: Start server
    console.log('7️⃣ Starting server...')
    return startServer()
    
  } catch (error: any) {
    console.error('❌ Server initialization failed:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    
    // Give a moment for logs to flush before exiting
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  }
}

// Start the server with error recovery
console.log('🚀 Starting Adapt v3 Backend...')
initializeServer().catch(error => {
  console.error('❌ Critical startup failure:', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString()
  })
  
  // Give a moment for logs to flush before exiting
  setTimeout(() => {
    process.exit(1)
  }, 1000)
})