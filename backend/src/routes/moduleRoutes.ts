import express from 'express'
import { moduleController } from '../controllers/moduleController.js'
import { DatabaseService } from '../services/prismaService.js'
import { UserService } from '../services/userService.js'
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

// Get all modules (Database-based) - optionally filtered by user
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching modules from database')
    
    // Get user ID if authenticated (optional for now)
    const userId = await UserService.getUserIdFromRequest(req)
    
    const modules = await DatabaseService.getAllModules(userId || undefined)
    
    console.log(`✅ Loaded ${modules.length} modules from database${userId ? ' for user' : ''}`)
    return res.json({ success: true, modules })
  } catch (err) {
    console.error('❌ Error loading modules:', err)
    return res.status(500).json({ 
      error: 'Could not load modules',
      details: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

// Delete module - Database-based with comprehensive cleanup
router.delete('/:id', async (req, res) => {
  const moduleId = req.params.id

  try {
    // Get user ID for activity logging
    const userId = await UserService.getUserIdFromRequest(req)
    
    // Delete from database (this will cascade delete related records)
    await DatabaseService.deleteModule(moduleId)

    // Delete associated files (ignore errors if files don't exist)
    const cleanupPromises = [
      fs.unlink(path.join(uploadsDir, `${moduleId}.mp4`)).catch(() => {}), // Video file
      fs.unlink(path.join(dataDir, `${moduleId}.json`)).catch(() => {}), // Data file
      fs.unlink(path.join(dataDir, 'transcripts', `${moduleId}.json`)).catch(() => {}) // Transcript
    ]
    
    await Promise.all(cleanupPromises)
    
    // Log activity
    await DatabaseService.createActivityLog({
      userId: userId || undefined,
      action: 'DELETE_MODULE',
      targetId: moduleId,
      metadata: { moduleId }
    })
    
    console.log(`✅ Successfully deleted module: ${moduleId}`)
    res.json({ success: true, id: moduleId, message: 'Module deleted successfully' })
  } catch (err) {
    console.error('Delete error:', err)
    res.status(500).json({ error: 'Failed to delete module' })
  }
})

// Get module by ID
router.get('/:id', moduleController.getModuleById)

// Get steps for a specific module
router.get('/:id/steps', async (req, res) => {
  const moduleId = req.params.id
  
  try {
    console.log(`📖 Getting steps for module: ${moduleId}`)
    
    // Get steps from database
    const steps = await DatabaseService.getSteps(moduleId)
    
    if (!steps || steps.length === 0) {
      console.error(`❌ Steps not found for module ${moduleId}`)
      return res.status(404).json({
        error: 'Steps not found',
        moduleId,
        message: 'No steps found in database'
      })
    }

    console.log(`✅ Successfully loaded ${steps.length} steps from database`)

    res.json({
      success: true,
      moduleId,
      steps,
      metadata: {
        totalSteps: steps.length,
        source: 'database',
        hasSteps: steps.length > 0
      }
    })

  } catch (error) {
    console.error('❌ Get steps error:', error)
    res.status(500).json({ 
      error: 'Failed to get steps',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Update module
router.put('/:id', moduleController.updateModule)

export { router as moduleRoutes } 