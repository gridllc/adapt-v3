import express from 'express'
import { moduleController } from '../controllers/moduleController.js'
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

// Get all modules (JSON file-based)
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching modules from:', modulesPath)
    console.log('🔍 Environment:', process.env.NODE_ENV)
    console.log('🔍 Base directory:', baseDir)
    console.log('🔍 Current directory:', process.cwd())
    
    // Check if file exists first
    try {
      await fs.access(modulesPath)
    } catch {
      console.log('📁 Modules file not found, creating empty array')
      // Ensure data directory exists
      await fs.mkdir(path.dirname(modulesPath), { recursive: true })
      await fs.writeFile(modulesPath, JSON.stringify([], null, 2))
    }
    
    const raw = await fs.readFile(modulesPath, 'utf-8')
    const modules = JSON.parse(raw)
    
    console.log(`✅ Loaded ${modules.length} modules`)
    return res.json({ success: true, modules })
  } catch (err) {
    console.error('❌ Error loading modules:', err)
    return res.status(500).json({ 
      error: 'Could not load modules',
      details: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

// Delete module - Direct implementation with comprehensive cleanup
router.delete('/:id', async (req, res) => {
  const moduleId = req.params.id

  try {
    // Read existing modules
    const raw = await fs.readFile(modulesPath, 'utf-8')
    const modules = JSON.parse(raw)

    // Find and remove the module
    const updated = modules.filter((m: any) => m.id !== moduleId)
    if (updated.length === modules.length) {
      return res.status(404).json({ error: 'Module not found' })
    }

    // Save updated modules.json
    await fs.writeFile(modulesPath, JSON.stringify(updated, null, 2))

    // Delete associated files (ignore errors if files don't exist)
    const cleanupPromises = [
      fs.unlink(path.join(uploadsDir, `${moduleId}.mp4`)).catch(() => {}), // Video file
      fs.unlink(path.join(dataDir, `${moduleId}.json`)).catch(() => {}), // Data file
      fs.unlink(path.join(dataDir, 'transcripts', `${moduleId}.json`)).catch(() => {}) // Transcript
    ]
    
    await Promise.all(cleanupPromises)
    
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
    
    // Define possible paths where steps might be stored
    const projectRoot = path.resolve(__dirname, '../../')
    const possiblePaths = [
      path.join(projectRoot, 'data', 'training', `${moduleId}.json`),
      path.join(projectRoot, 'data', 'steps', `${moduleId}.json`),
      path.join(projectRoot, 'data', 'modules', `${moduleId}.json`),
      path.join(process.cwd(), 'data', 'training', `${moduleId}.json`),
      path.join(process.cwd(), 'data', 'steps', `${moduleId}.json`)
    ]

    console.log('🔍 Searching in paths:', possiblePaths)

    let stepsData = null
    let foundPath = null

    // Try each path until we find the file
    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath)
        console.log(`✅ Found steps file at: ${filePath}`)
        const rawData = await fs.readFile(filePath, 'utf-8')
        stepsData = JSON.parse(rawData)
        foundPath = filePath
        break
      } catch (error) {
        console.log(`❌ Not found: ${filePath}`)
      }
    }

    if (!stepsData) {
      console.error(`❌ Steps not found for module ${moduleId}`)
      return res.status(404).json({
        error: 'Steps not found',
        moduleId,
        searchedPaths: possiblePaths,
        message: 'Check server logs for detailed debugging info'
      })
    }

    console.log(`✅ Successfully loaded steps from: ${foundPath}`)
    
    // Return the steps based on the file structure
    let steps = []
    if (stepsData.steps) {
      steps = stepsData.steps
    } else if (stepsData.enhancedSteps) {
      steps = stepsData.enhancedSteps
    } else if (stepsData.structuredSteps) {
      steps = stepsData.structuredSteps
    } else if (Array.isArray(stepsData)) {
      steps = stepsData
    } else {
      // If it's a module data object, extract steps
      steps = stepsData.originalSteps || stepsData.moduleSteps || []
    }

    console.log(`📦 Returning ${steps.length} steps for module ${moduleId}`)

    res.json({
      success: true,
      moduleId,
      steps,
      metadata: {
        totalSteps: steps.length,
        sourceFile: foundPath,
        hasEnhancedSteps: !!stepsData.enhancedSteps,
        hasStructuredSteps: !!stepsData.structuredSteps,
        stats: stepsData.stats || null
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