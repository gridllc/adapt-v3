import { Router } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { ok, fail } from '../utils/http.js'

export const stepsRoutes = Router()

stepsRoutes.get('/:moduleId', async (req, res) => {
  try {
    const steps = await ModuleService.getSteps(req.params.moduleId)
    ok(res, { steps })
  } catch (e) {
    fail(res, 500, 'failed to load steps')
  }
})
