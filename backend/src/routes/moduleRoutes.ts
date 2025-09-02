import express from 'express'
import { ModuleService } from '../services/moduleService.js'
import { DatabaseService } from '../services/prismaService.js'
import { prisma } from '../config/database.js'
import { deleteFromS3 } from '../services/s3Uploader.js'
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

// Get all modules for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.userId

    // In development, allow unauthenticated access for testing
    if (!userId && process.env.NODE_ENV === 'development') {
      console.log('🔧 DEV MODE: Allowing unauthenticated access to modules')
      const result = await ModuleService.getAllModules()
      return res.json(result)
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      })
    }

    const result = await ModuleService.getUserModules(userId)

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
    console.log(`[MODULE] Getting module: ${id}`)

    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        feedbacks: true,
        questions: true
      }
    })

    console.log(`[MODULE] Module found:`, !!module)

    if (!module) {
      console.log(`[MODULE] Module ${id} not found`)
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      })
    }

    console.log(`[MODULE] Module data: ${module.steps.length} steps, ${module.questions.length} questions`)

    res.json({
      success: true,
      module: {
        ...module,
        stepCount: module.steps.length,
        feedbackCount: module.feedbacks.length,
        questionCount: module.questions.length,
        // Include lastError for frontend error display
        lastError: module.lastError
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

// DELETE /api/modules/:id - Complete module cleanup (S3 + DB)
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    console.log(`[TEST] 🗑️ Starting deletion for module: ${id}`)
    
    // Find the module first to get S3 key
    const module = await prisma.module.findUnique({ 
      where: { id },
      include: { 
        steps: {
          select: {
            id: true,
            text: true,
            startTime: true,
            endTime: true,
            order: true
          }
        }, 
        questions: {
          select: {
            id: true,
            question: true
          }
        } 
      }
    })

    if (!module) {
      console.warn(`[TEST] ⚠️ Module ${id} not found for deletion`)
      return res.status(404).json({ error: 'Module not found' })
    }

    console.log(`[TEST] 📁 Module found: ${module.title}, file: ${module.filename}`)
    console.log(`[TEST] 📊 Will delete ${module.steps.length} steps and ${module.questions.length} questions`)

    // Delete from S3 first (if it exists)
    try {
      if (module.filename) {
        await deleteFromS3(module.filename)
        console.log(`[TEST] ✅ S3 file deleted: ${module.filename}`)
      }
    } catch (s3Error) {
      console.warn(`[TEST] ⚠️ S3 deletion failed (file may not exist): ${s3Error}`)
      // Continue with DB deletion even if S3 fails
    }

    // Delete from DB in correct order (due to foreign key constraints)
    // 1. Delete related records first
    await prisma.question.deleteMany({ where: { moduleId: id } })
    console.log(`[TEST] 🗃️ Deleted ${module.questions.length} questions`)

    await prisma.step.deleteMany({ where: { moduleId: id } })
    console.log(`[TEST] 🗃️ Deleted ${module.steps.length} steps`)

    // 2. Delete the module itself
    await prisma.module.delete({ where: { id } })
    console.log(`[TEST] 🗃️ Deleted module: ${id}`)

    console.log(`[TEST] ✅ Complete deletion successful for module: ${id}`)
    res.json({ 
      success: true, 
      message: `Module ${id} and all related data deleted successfully`,
      deletedItems: {
        module: module.title,
        steps: module.steps.length,
        questions: module.questions.length,
        s3File: module.filename
      }
    })

  } catch (err: any) {
    console.error(`[TEST] ❌ Failed to delete module ${id}:`, err.message)
    res.status(500).json({ 
      error: 'Deletion failed', 
      details: err.message,
      moduleId: id
    })
  }
})

export { router as moduleRoutes } 