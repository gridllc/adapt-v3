import express from 'express'
import { ModuleService } from '../services/moduleService.js'
import { DatabaseService } from '../services/prismaService.js'
import { prisma } from '../config/database.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Handle both development and production paths
const isProduction = process.env.NODE_ENV === 'production'
const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')
const modulesPath = path.join(process.cwd(), 'data', 'modules.json')
const uploadsDir = path.join(process.cwd(), 'uploads')
const dataDir = path.join(process.cwd(), 'data')

// Get all modules with enhanced info
router.get('/', async (req, res) => {
  try {
    const result = await ModuleService.getAllModules()
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('❌ Error in GET /api/modules:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Get orphaned modules (ready status but no steps)
router.get('/orphaned', async (req, res) => {
  try {
    const result = await ModuleService.getOrphanedModules()
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('❌ Error in GET /api/modules/orphaned:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Mark orphaned modules as failed
router.post('/orphaned/mark-failed', async (req, res) => {
  try {
    const result = await ModuleService.markOrphanedAsFailed()
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('❌ Error in POST /api/modules/orphaned/mark-failed:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Clean up old failed modules
router.post('/cleanup', async (req, res) => {
  try {
    const { daysOld = 7 } = req.body
    const result = await ModuleService.cleanupOldFailedModules(daysOld)
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('❌ Error in POST /api/modules/cleanup:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Get module statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await ModuleService.getModuleStats()
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('❌ Error in GET /api/modules/stats:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Get specific module by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        user: {
          select: {
            email: true,
            name: true
          }
        },
        _count: {
          select: {
            steps: true,
            feedbacks: true,
            questions: true
          }
        }
      }
    })

    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      })
    }

    res.json({
      success: true,
      module: {
        ...module,
        stepCount: module._count.steps,
        feedbackCount: module._count.feedbacks,
        questionCount: module._count.questions
      }
    })
  } catch (error) {
    console.error('❌ Error in GET /api/modules/:id:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

export { router as moduleRoutes } 