import express from 'express'
import { stepsController } from '../controllers/stepsController.js'

const router = express.Router()

// Get steps for a specific module
router.get('/:moduleId', stepsController.getSteps)

// Create steps for a module
router.post('/:moduleId', stepsController.createSteps)

// Update steps for a module
router.put('/:moduleId', stepsController.updateSteps)

// AI rewrite endpoint
router.post('/:moduleId/rewrite', stepsController.rewriteStep)

export { router as stepsRoutes }
