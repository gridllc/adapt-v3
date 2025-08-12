import express from 'express'
import { stepsController } from '../controllers/stepsController.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// Get steps for a specific module (public)
router.get('/:moduleId', stepsController.getSteps)

// Generate steps using AI for a module (protected) - Frontend expects this route
// MUST come before /:moduleId to avoid route conflicts
router.post('/generate/:moduleId', requireAuth, stepsController.createSteps)

// Create steps for a module (protected)
router.post('/:moduleId', requireAuth, stepsController.createSteps)

// Update steps for a module (protected)
router.put('/:moduleId', requireAuth, stepsController.updateSteps)

// AI rewrite endpoint (protected)
router.post('/:moduleId/rewrite', requireAuth, stepsController.rewriteStep)

export { router as stepsRoutes }
