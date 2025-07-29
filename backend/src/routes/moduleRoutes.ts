import express from 'express'
import { moduleController } from '../controllers/moduleController.js'
import path from 'path'
import fs from 'fs'

const router = express.Router()

// Get all modules (JSON file-based)
router.get('/modules', async (req, res) => {
  const dataPath = path.resolve(__dirname, '../data/modules.json')
  try {
    const raw = await fs.promises.readFile(dataPath, 'utf-8')
    const modules = JSON.parse(raw)
    return res.json({ success: true, modules })
  } catch (err) {
    console.error('Error loading modules:', err)
    return res.status(500).json({ error: 'Could not load modules' })
  }
})

// Existing controller-based endpoints
// Get all modules
router.get('/', moduleController.getAllModules)
// Get module by ID
router.get('/:id', moduleController.getModuleById)
// Update module
router.put('/:id', moduleController.updateModule)
// Delete module
router.delete('/:id', moduleController.deleteModule)

export { router as moduleRoutes } 