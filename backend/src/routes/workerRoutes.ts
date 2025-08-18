// backend/src/routes/workerRoutes.ts
import express from 'express'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { ModuleService } from '../services/moduleService.js'
import { logger } from '../utils/logger.js'

const router = express.Router()

// QStash V2 worker endpoint (primary)
router.post('/process', async (req, res) => {
  const { moduleId } = req.body

  if (!moduleId) {
    logger.error('❌ Missing moduleId in worker request', req.body)
    return res.status(400).json({ error: 'Missing moduleId' })
  }

  try {
    logger.info(`🧵 [${moduleId}] Worker started`)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Worker processing started')

    await startProcessing(moduleId)

    logger.info(`✅ [${moduleId}] Worker finished`)
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    logger.error(`❌ Worker error for ${moduleId}:`, err)
    try {
      await ModuleService.updateModuleStatus(
        moduleId,
        'FAILED',
        0,
        err?.message || 'processing failed'
      )
    } catch (statusErr) {
      logger.error(`⚠️ Failed to update status for ${moduleId}:`, statusErr)
    }
    return res.status(500).json({ error: 'processing failed' })
  }
})

// Legacy fallback for direct calls (protected by JOB_SECRET)
router.post('/process/:moduleId', async (req, res) => {
  const JOB_SECRET = process.env.WORKER_JOB_SECRET
  if (JOB_SECRET && req.get('x-job-secret') !== JOB_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { moduleId } = req.params
  try {
    logger.info(`🧵 Legacy worker start for ${moduleId}`)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Worker processing started')

    await startProcessing(moduleId)

    logger.info(`✅ Legacy worker finished for ${moduleId}`)
    return res.json({ ok: true })
  } catch (err: any) {
    logger.error(`❌ Legacy worker error for ${moduleId}:`, err)
    try {
      await ModuleService.updateModuleStatus(
        moduleId,
        'FAILED',
        0,
        err?.message || 'processing failed'
      )
    } catch (statusErr) {
      logger.error(`⚠️ Failed to update status for ${moduleId}:`, statusErr)
    }
    return res.status(500).json({ error: 'processing failed' })
  }
})

// Health check for Render + QStash
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'qstash-worker',
    timestamp: new Date().toISOString()
  })
})

export { router as workerRoutes }
