import express from 'express'
import { prisma } from '../config/database.js'

const router = express.Router()

// Debug endpoint to list all modules with summary
router.get('/modules/debug', async (req, res) => {
  try {
    console.log('[TEST] Debug modules requested')
    
    const modules = await prisma.module.findMany({
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
      take: 20
    })

    const summary = modules.map((mod) => ({
      id: mod.id,
      title: mod.title || 'Untitled',
      status: mod.status,
      steps: mod.steps.length,
      feedbacks: mod._count.feedbacks,
      questions: mod._count.questions,
      createdAt: mod.createdAt,
      updatedAt: mod.updatedAt,
      userId: mod.userId || 'No user'
    }))

    console.log(`[TEST] Debug modules response: ${summary.length} modules`)
    res.json(summary)
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
        details: module.steps.map(step => ({
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

    const summary = orphanedModules.map((mod) => ({
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

export { router as debugRoutes } 