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
        bucket: process.env.AWS_BUCKET_NAME || 'MISSING',
                  region: process.env.AWS_REGION || 'MISSING',
        accessKey: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
        
        // Alternative names that might be in Render:
        bucketAlt: process.env.AWS_BUCKET_NAME || 'N/A',
        regionAlt: process.env.AWS_REGION || 'N/A'
      },
      
      // QStash Queue
      qstash: {
        // What your code expects:
        token: process.env.QSTASH_TOKEN ? 'SET' : 'MISSING',
        endpoint: process.env.QSTASH_ENDPOINT || 'https://qstash.upstash.io/v1/publish',
        workerUrl: process.env.QSTASH_WORKER_URL ? 'SET' : 'MISSING',
        signingKey: process.env.QSTASH_CURRENT_SIGNING_KEY ? 'SET' : 'MISSING',
        
        // Alternative that might be in Render:
        qstashUrl: process.env.QSTASH_URL || 'N/A',
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ? 'SET' : 'MISSING',
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ? 'SET' : 'MISSING'
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
          !process.env.AWS_BUCKET_NAME && 'AWS_BUCKET_NAME',
          !process.env.AWS_ACCESS_KEY_ID && 'AWS_ACCESS_KEY_ID',
          !process.env.CLERK_SECRET_KEY && 'CLERK_SECRET_KEY'
        ].filter(Boolean),
        renderMismatches: [
          !process.env.AWS_BUCKET_NAME && process.env.S3_BUCKET_NAME && 'S3_BUCKET_NAME→AWS_BUCKET_NAME',
                      !process.env.AWS_REGION && process.env.S3_REGION && 'S3_REGION→AWS_REGION',
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

// S3 Debug - Shows S3 configuration specifically
router.get('/s3', (req, res) => {
  try {
    console.log('[TEST] 🔍 S3 debug requested')
    
    const s3Debug = {
      // What your code expects:
      aws: {
        bucket: process.env.AWS_BUCKET_NAME || 'MISSING',
        region: process.env.AWS_REGION || 'MISSING',
        accessKey: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
      },
      
      // Alternative names that might be in Render:
      s3: {
        bucket: process.env.S3_BUCKET_NAME || 'MISSING',
        region: process.env.S3_REGION || 'MISSING',
      },
      
      // Analysis
      analysis: {
        hasAllRequired: !!(process.env.AWS_BUCKET_NAME && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        hasAlternativeNames: !!(process.env.S3_BUCKET_NAME || process.env.S3_REGION),
        missing: [
          !process.env.AWS_BUCKET_NAME && !process.env.S3_BUCKET_NAME && 'BUCKET_NAME',
          !process.env.AWS_REGION && !process.env.S3_REGION && 'REGION',
          !process.env.AWS_ACCESS_KEY_ID && 'ACCESS_KEY_ID',
          !process.env.AWS_SECRET_ACCESS_KEY && 'SECRET_ACCESS_KEY'
        ].filter(Boolean)
      }
    }
    
    console.log(`[TEST] 🔍 S3 config analysis:`, s3Debug.analysis)
    
    res.json(s3Debug)
    
  } catch (error: any) {
    console.error('[TEST] ❌ S3 debug failed:', error.message)
    res.status(500).json({ 
      error: 'S3 debug failed', 
      details: error.message 
    })
  }
})

// Test S3 Connection - Actually tries to connect to S3
router.get('/s3-test', async (req, res) => {
  try {
    console.log('[TEST] 🔍 S3 connection test requested')
    
    // Import storageService to test actual S3 connection
    const { storageService } = await import('../services/storageService.js')
    
    if (!storageService.isS3Enabled()) {
      return res.status(500).json({
        error: 'S3 not enabled',
        message: 'S3 client failed to initialize',
        timestamp: new Date().toISOString()
      })
    }
    
    // Try to list buckets to test connection
    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3')
    const testClient = new S3Client({
      region: process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
    
    try {
      const result = await testClient.send(new ListBucketsCommand({}))
      const bucketNames = result.Buckets?.map(b => b.Name) || []
      
      res.json({
        success: true,
        message: 'S3 connection successful',
        buckets: bucketNames,
        targetBucket: process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME,
        targetBucketExists: bucketNames.includes(process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || ''),
        timestamp: new Date().toISOString()
      })
    } catch (s3Error: any) {
      res.status(500).json({
        error: 'S3 connection failed',
        message: s3Error.message,
        code: s3Error.Code,
        timestamp: new Date().toISOString()
      })
    }
    
  } catch (error: any) {
    console.error('[TEST] ❌ S3 test failed:', error.message)
    res.status(500).json({ 
      error: 'S3 test failed', 
      details: error.message 
    })
  }
})

// Comprehensive S3 Environment Check
router.get('/s3-env', (req, res) => {
  try {
    console.log('[TEST] 🔍 S3 environment check requested')
    
    const s3EnvCheck = {
      // Raw environment variables
      raw: {
        AWS_REGION: process.env.AWS_REGION || 'MISSING',
        S3_REGION: process.env.S3_REGION || 'MISSING',
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || 'MISSING',
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'MISSING',
      },
      
      // Fallback values (what your code actually uses)
      fallback: {
        region: process.env.AWS_REGION || process.env.S3_REGION || 'MISSING',
        bucket: process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'MISSING',
        accessKey: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        secretKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
      },
      
      // Analysis
      analysis: {
        hasAllRequired: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && (process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME) && (process.env.AWS_REGION || process.env.S3_REGION)),
        missing: [
          !process.env.AWS_ACCESS_KEY_ID && 'AWS_ACCESS_KEY_ID',
          !process.env.AWS_SECRET_ACCESS_KEY && 'AWS_SECRET_ACCESS_KEY',
          !process.env.AWS_BUCKET_NAME && !process.env.S3_BUCKET_NAME && 'BUCKET_NAME (AWS_BUCKET_NAME or S3_BUCKET_NAME)',
          !process.env.AWS_REGION && !process.env.S3_REGION && 'REGION (AWS_REGION or S3_REGION)'
        ].filter(Boolean),
        namingMismatches: [
          !process.env.AWS_BUCKET_NAME && process.env.S3_BUCKET_NAME && 'Using S3_BUCKET_NAME instead of AWS_BUCKET_NAME',
          !process.env.AWS_REGION && process.env.S3_REGION && 'Using S3_REGION instead of AWS_REGION'
        ].filter(Boolean)
      },
      
      // What your code expects vs what's available
      codeExpectations: {
        expected: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME', 'AWS_REGION'],
        available: [
          process.env.AWS_ACCESS_KEY_ID && 'AWS_ACCESS_KEY_ID',
          process.env.AWS_SECRET_ACCESS_KEY && 'AWS_SECRET_ACCESS_KEY',
          process.env.AWS_BUCKET_NAME && 'AWS_BUCKET_NAME',
          process.env.S3_BUCKET_NAME && 'S3_BUCKET_NAME',
          process.env.AWS_REGION && 'AWS_REGION',
          process.env.S3_REGION && 'S3_REGION'
        ].filter(Boolean)
      }
    }
    
    console.log(`[TEST] 🔍 S3 env analysis:`, s3EnvCheck.analysis)
    
    res.json(s3EnvCheck)
    
  } catch (error: any) {
    console.error('[TEST] ❌ S3 env check failed:', error.message)
    res.status(500).json({ 
      error: 'S3 env check failed', 
      details: error.message 
    })
  }
})

export { router as debugRoutes } 