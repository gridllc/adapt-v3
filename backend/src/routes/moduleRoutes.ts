import { Router } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { ok, fail } from '../utils/http.js'

export const moduleRoutes = Router()

// GET /api/modules/:id
moduleRoutes.get('/:id', async (req, res) => {
  try {
    const module = await ModuleService.get(req.params.id)
    if (!module) return fail(res, 404, 'not found')
    const steps = await ModuleService.getSteps(req.params.id)
    ok(res, { module, steps })
  } catch (e) {
    fail(res, 500, 'failed')
  }
})

// GET /api/modules/:id/status
moduleRoutes.get('/:id/status', async (req, res) => {
  try {
    const module = await ModuleService.get(req.params.id)
    if (!module) return fail(res, 404, 'not found')
    ok(res, { module })
  } catch (e) {
    fail(res, 500, 'failed')
  }
})