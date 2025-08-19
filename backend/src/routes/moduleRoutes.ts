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

// FIXED: Use moduleId parameter and ModuleService
router.get('/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { includeRelations = 'true' } = req.query

    // Use ModuleService instead of direct Prisma
    const result = await ModuleService.getModuleById(
      moduleId,
      includeRelations === 'true'
    )

    if (result.success) {
      res.json({
        success: true,
        module: result.module
      })
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'Module not found'
      })
    }
  } catch (error) {
    console.error('❌ Error in GET /api/modules/:moduleId:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// NEW: Get module steps specifically (using ModuleService)
router.get('/:moduleId/steps', async (req, res) => {
  try {
    const { moduleId } = req.params

    const result = await ModuleService.getModuleSteps(moduleId)

    if (result.success) {
      res.json({
        success: true,
        steps: result.steps
      })
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'Module steps not found'
      })
    }
  } catch (error) {
    console.error('❌ Error in GET /api/modules/:moduleId/steps:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// NEW: Update module status (expose ModuleService method)
router.post('/:moduleId/status', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { status, progress, message } = req.body

    const result = await ModuleService.updateModuleStatus(moduleId, status, progress, message)

    if (result.success) {
      res.json({
        success: true,
        message: 'Module status updated successfully'
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to update module status'
      })
    }
  } catch (error) {
    console.error('❌ Error in POST /api/modules/:moduleId/status:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// NEW: Save steps to module (expose ModuleService method)
router.post('/:moduleId/steps', async (req, res) => {
  try {
    const { moduleId } = req.params
    const { steps } = req.body

    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'Steps array is required'
      })
    }

    const result = await ModuleService.saveStepsToModule(moduleId, steps)

    if (result.success) {
      res.json({
        success: true,
        stepCount: result.stepCount,
        createdSteps: result.createdSteps,
        message: result.message
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to save steps'
      })
    }
  } catch (error) {
    console.error('❌ Error in POST /api/modules/:moduleId/steps:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// ENHANCED: Delete using ModuleService first, then S3 cleanup
router.delete('/:moduleId', async (req, res) => {
  const { moduleId } = req.params

  try {
    console.log(`[TEST] 🗑️ Starting deletion for module: ${moduleId}`)

    // Find the module first to get S3 key and related data info
    const moduleResult = await ModuleService.getModuleById(moduleId, true)

    if (!moduleResult.success || !moduleResult.module) {
      console.warn(`[TEST] ⚠️ Module ${moduleId} not found for deletion`)
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      })
    }

    const module = moduleResult.module
    console.log(`[TEST] 📁 Module found: ${module.title}, file: ${module.filename}`)
    console.log(`[TEST] 📊 Will delete ${module.steps?.length || 0} steps and ${module.feedbacks?.length || 0} feedbacks`)

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

    // Use ModuleService for database deletion (handles cascading properly)
    const deleteResult = await ModuleService.deleteModule(moduleId)

    if (deleteResult.success) {
      console.log(`[TEST] ✅ Complete deletion successful for module: ${moduleId}`)
      res.json({
        success: true,
        message: `Module ${moduleId} and all related data deleted successfully`,
        deletedItems: {
          module: module.title,
          steps: module.steps?.length || 0,
          feedbacks: module.feedbacks?.length || 0,
          s3File: module.filename
        }
      })
    } else {
      throw new Error(deleteResult.error || 'Database deletion failed')
    }

  } catch (err: any) {
    console.error(`[TEST] ❌ Failed to delete module ${moduleId}:`, err.message)
    res.status(500).json({
      success: false,
      error: 'Deletion failed',
      details: err.message,
      moduleId: moduleId
    })
  }
})

export { router as moduleRoutes }