import express from 'express'
import { stepsController } from '../controllers/stepsController.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// Get steps for a specific module (public)
router.get('/:moduleId', stepsController.getSteps)

// Generate steps using AI for a module (simple secret protection) - Frontend expects this route
// MUST come before /:moduleId to avoid route conflicts
router.post('/generate/:moduleId', async (req, res) => {
  // simple safeguard with a shared secret, or remove entirely if you trust the FE
  if (process.env.GENERATE_SECRET && req.get('x-generate-secret') !== process.env.GENERATE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { moduleId } = req.params
  const { aiPipeline } = await import('../services/ai/aiPipeline.js')
  setImmediate(() => aiPipeline.processModule(moduleId).catch(e => console.error('manual gen fail', e)))
  res.json({ ok: true, moduleId })
})

// Create steps for a module (protected)
router.post('/:moduleId', requireAuth, stepsController.createSteps)

// Update steps for a module (protected)
router.put('/:moduleId', requireAuth, stepsController.updateSteps)

// AI rewrite endpoint (protected)
router.post('/:moduleId/rewrite', requireAuth, stepsController.rewriteStep)

export { router as stepsRoutes }
