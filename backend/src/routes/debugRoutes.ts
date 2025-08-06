import express from 'express'
import { prisma } from '../config/database.js'

const router = express.Router()

// Debug endpoint to list all modules with summary
// Query params: ?status=failed&limit=50&stuck=true
router.get('/modules/debug', async (req, res) => {
  try {
    console.log('[TEST] Debug modules requested')
    
    const { status, limit = '20', stuck } = req.query
    const maxLimit = Math.min(parseInt(limit as string) || 20, 100)
    
    // Build query filters
    const whereClause: any = {}
    if (status) {
      whereClause.status = status
    }
    
    const modules = await prisma.module.findMany({
      where: whereClause,
      include: { 
        steps: true,
        _count: {
          select: {
            steps: true,
            feedbacks: true,
            questions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: maxLimit
    })

    let filteredModules = modules
    
    // Filter for "stuck" modules (status ready but no steps)
    if (stuck === 'true') {
      filteredModules = modules.filter((mod: any) => 
        mod.status === 'ready' && mod.steps.length === 0
      )
    }

    const summary = filteredModules.map((mod: any) => ({
      id: mod.id,
      title: mod.title || 'Untitled',
      status: mod.status,
      steps: mod.steps.length,
      feedbacks: mod._count.feedbacks,
      questions: mod._count.questions,
      createdAt: mod.createdAt,
      updatedAt: mod.updatedAt,
      userId: mod.userId || 'No user',
      // Helper flags for tester convenience
      isStuck: mod.status === 'ready' && mod.steps.length === 0,
      needsAttention: mod.status === 'failed' || (mod.status === 'ready' && mod.steps.length === 0),
      trainingUrl: `/training/${mod.id}`
    }))

    console.log(`[TEST] Debug modules response: ${summary.length} modules (filtered from ${modules.length})`)
    res.json({
      modules: summary,
      total: summary.length,
      filters: { status, stuck: stuck === 'true', limit: maxLimit },
      helpful_queries: {
        all_failed: '/api/debug/modules/debug?status=failed',
        stuck_modules: '/api/debug/modules/debug?stuck=true',
        recent_50: '/api/debug/modules/debug?limit=50'
      }
    })
  } catch (err) {
    console.error('[TEST] Debug modules error:', err)
    res.status(500).json({ 
      error: 'Failed to fetch module summaries',
      details: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

// Debug endpoint to get detailed module info
router.get('/modules/:id/debug', async (req, res) => {
  try {
    const { id } = req.params
    console.log(`[TEST] Debug module requested: ${id}`)
    
    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        feedbacks: true,
        questions: true,
        statuses: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    if (!module) {
      return res.status(404).json({ error: 'Module not found' })
    }

    const debugInfo = {
      id: module.id,
      title: module.title,
      filename: module.filename,
      videoUrl: module.videoUrl,
      status: module.status,
      progress: module.progress,
      userId: module.userId,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
      steps: {
        count: module.steps.length,
        details: module.steps.map((step: any) => ({
          id: step.id,
          title: step.title,
          startTime: step.startTime,
          endTime: step.endTime,
          order: step.order
        }))
      },
      feedbacks: {
        count: module.feedbacks.length,
        recent: module.feedbacks.slice(0, 3)
      },
      questions: {
        count: module.questions.length,
        recent: module.questions.slice(0, 3)
      },
      statuses: module.statuses
    }

    console.log(`[TEST] Debug module response for ${id}`)
    res.json(debugInfo)
  } catch (err) {
    console.error('[TEST] Debug module error:', err)
    res.status(500).json({ 
      error: 'Failed to fetch module debug info',
      details: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

// Debug endpoint to list orphaned modules (no steps)
router.get('/modules/orphaned/debug', async (req, res) => {
  try {
    console.log('[TEST] Debug orphaned modules requested')
    
    const orphanedModules = await prisma.module.findMany({
      where: {
        status: 'ready',
        steps: {
          none: {}
        }
      },
      include: {
        _count: {
          select: {
            steps: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const summary = orphanedModules.map((mod: any) => ({
      id: mod.id,
      title: mod.title || 'Untitled',
      status: mod.status,
      steps: mod._count.steps,
      createdAt: mod.createdAt,
      updatedAt: mod.updatedAt
    }))

    console.log(`[TEST] Debug orphaned modules response: ${summary.length} orphaned modules`)
    res.json(summary)
  } catch (err) {
    console.error('[TEST] Debug orphaned modules error:', err)
    res.status(500).json({ 
      error: 'Failed to fetch orphaned modules',
      details: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

// Admin Debug View - Quick overview of all modules
router.get('/modules/debug', async (_req, res) => {
  try {
    console.log('[TEST] 🔍 Admin debug: Fetching module overview...')
    
    const modules = await prisma.module.findMany({
      include: { 
        steps: true,
        user: {
          select: {
            email: true,
            clerkId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to most recent 50 for performance
    })

    const summary = modules.map((m: any) => ({
      id: m.id,
      title: m.title || 'Untitled',
      status: m.status,
      stepCount: m.steps.length,
      fileName: m.filename,
      videoUrl: m.videoUrl,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      progress: m.progress,
      userEmail: m.user?.email || 'Unknown',
      userId: m.userId
    }))

    console.log(`[TEST] ✅ Admin debug: Found ${summary.length} modules`)
    res.json({
      totalModules: summary.length,
      modules: summary,
      generatedAt: new Date().toISOString()
    })
    
  } catch (err: any) {
    console.error('[TEST] ❌ Admin debug failed:', err.message)
    res.status(500).json({ 
      error: 'Failed to fetch debug info', 
      details: err.message 
    })
  }
})

// Environment Debug - Shows what backend actually sees
router.get('/env', (req, res) => {
  try {
    console.log('[TEST] 🔍 Environment debug requested')
    
    const envDebug = {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      
      // Database
      database: {
        url: process.env.DATABASE_URL ? 'SET' : 'MISSING',
        urlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...' || 'N/A'
      },
      
      // AWS S3 (checking both naming conventions)
      s3: {
        // What your code expects:
        bucket: process.env.S3_BUCKET_NAME || 'MISSING',
        region: process.env.S3_REGION || 'MISSING',
        accessKey: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
        
        // Alternative names that might be in Render:
        bucketAlt: process.env.AWS_BUCKET_NAME || 'N/A',
        regionAlt: process.env.AWS_REGION || 'N/A'
      },
      
      // Redis (checking both conventions)
      redis: {
        // What your code expects:
        upstashUrl: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'MISSING',
        upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'MISSING',
        useRedis: process.env.USE_REDIS,
        
        // Alternative that might be in Render:
        redisUrl: process.env.REDIS_URL || 'N/A'
      },
      
      // QStash (checking both conventions)
      qstash: {
        // What your code expects:
        token: process.env.QSTASH_TOKEN ? 'SET' : 'MISSING',
        endpoint: process.env.QSTASH_ENDPOINT || 'DEFAULT',
        workerUrl: process.env.QSTASH_WORKER_URL ? 'SET' : 'MISSING',
        signingKey: process.env.QSTASH_CURRENT_SIGNING_KEY ? 'SET' : 'MISSING',
        
        // Alternative that might be in Render:
        qstashUrl: process.env.QSTASH_URL || 'N/A'
      },
      
      // AI Services
      ai: {
        openai: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
        gemini: process.env.GEMINI_API_KEY ? 'SET' : 'MISSING',
        googleEmail: process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'MISSING',
        googleKey: process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'MISSING',
        googleProject: process.env.GOOGLE_PROJECT_ID ? 'SET' : 'MISSING'
      },
      
      // Auth
      auth: {
        clerkSecret: process.env.CLERK_SECRET_KEY ? 'SET' : 'MISSING',
        frontendUrl: process.env.FRONTEND_URL || 'DEFAULT'
      },
      
      // Environment analysis
      analysis: {
        totalEnvVars: Object.keys(process.env).length,
        criticalMissing: [
          !process.env.DATABASE_URL && 'DATABASE_URL',
          !process.env.S3_BUCKET_NAME && 'S3_BUCKET_NAME',
          !process.env.AWS_ACCESS_KEY_ID && 'AWS_ACCESS_KEY_ID',
          !process.env.CLERK_SECRET_KEY && 'CLERK_SECRET_KEY'
        ].filter(Boolean),
        renderMismatches: [
          !process.env.S3_BUCKET_NAME && process.env.AWS_BUCKET_NAME && 'AWS_BUCKET_NAME→S3_BUCKET_NAME',
          !process.env.S3_REGION && process.env.AWS_REGION && 'AWS_REGION→S3_REGION',
          !process.env.QSTASH_ENDPOINT && process.env.QSTASH_URL && 'QSTASH_URL→QSTASH_ENDPOINT'
        ].filter(Boolean)
      }
    }
    
    console.log(`[TEST] 🔍 Found ${envDebug.analysis.criticalMissing.length} critical missing vars`)
    console.log(`[TEST] 🔍 Found ${envDebug.analysis.renderMismatches.length} potential naming mismatches`)
    
    res.json(envDebug)
    
  } catch (error: any) {
    console.error('[TEST] ❌ Environment debug failed:', error.message)
    res.status(500).json({ 
      error: 'Environment debug failed', 
      details: error.message 
    })
  }
})

export { router as debugRoutes } 