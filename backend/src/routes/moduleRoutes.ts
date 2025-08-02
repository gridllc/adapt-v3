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
const modulesPath = path.join(baseDir, 'data', 'modules.json')
const uploadsDir = path.join(baseDir, 'uploads')
const dataDir = path.join(baseDir, 'data')

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
// Update module
router.put('/:id', moduleController.updateModule)

export { router as moduleRoutes } 