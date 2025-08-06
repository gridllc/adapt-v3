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

export { router as debugRoutes } 