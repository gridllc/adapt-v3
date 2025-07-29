import express from 'express'
import { moduleController } from '../controllers/moduleController.js'

const router = express.Router()

// Get all modules
router.get('/', moduleController.getAllModules)

// Get module by ID
router.get('/:id', moduleController.getModuleById)

// Update module
router.put('/:id', moduleController.updateModule)

// Delete module
router.delete('/:id', moduleController.deleteModule)

export { router as moduleRoutes } 