// backend/src/routes/workerRoutes.ts
import express from 'express'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { ModuleService } from '../services/moduleService.js'
import { log } from '../utils/logger.js'
import { verifyQStashWebhook } from '../services/qstashQueue.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const router = express.Router()

// Centralized QStash handler function
const qstashHandler = async (req: express.Request, res: express.Response) => {
  // Verify QStash webhook signature
  if (!verifyQStashWebhook(req)) {
    log.error('❌ QStash webhook verification failed')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { moduleId } = req.body

  if (!moduleId) {
    log.error('❌ Missing moduleId in worker request', req.body)
    return res.status(400).json({ error: 'Missing moduleId' })
  }

  try {
    log.info(`🧵 [${moduleId}] Worker started`)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Worker processing started')

    log.info(`🚀 [${moduleId}] Calling startProcessing...`)
    const result = await startProcessing(moduleId)
    log.info(`✅ [${moduleId}] startProcessing completed with result:`, result)

    log.info(`✅ [${moduleId}] Worker finished`)
    return res.status(200).json({ ok: true, result })
  } catch (err: any) {
    log.error(`❌ Worker error for ${moduleId}:`, err)
    log.error(`❌ Error stack:`, err.stack)
    try {
      await ModuleService.updateModuleStatus(
        moduleId,
        'FAILED',
        0,
        err?.message || 'processing failed'
      )
    } catch (statusErr) {
      log.error(`⚠️ Failed to update status for ${moduleId}:`, statusErr)
    }
    return res.status(500).json({ error: 'processing failed', details: err.message })
  }
}

// endpoint QStash calls back to
router.post("/process", qstashHandler)

// Legacy fallback for direct calls (protected by JOB_SECRET)
router.post('/process/:moduleId', async (req, res) => {
  const JOB_SECRET = process.env.WORKER_JOB_SECRET
  if (JOB_SECRET && req.get('x-job-secret') !== JOB_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { moduleId } = req.params
  try {
    log.info(`🧵 Legacy worker start for ${moduleId}`)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Worker processing started')

    log.info(`🚀 [${moduleId}] Calling startProcessing...`)
    const result = await startProcessing(moduleId)
    log.info(`✅ [${moduleId}] startProcessing completed with result:`, result)

    log.info(`✅ Legacy worker finished for ${moduleId}`)
    return res.json({ ok: true, result })
  } catch (err: any) {
    log.error(`❌ Legacy worker error for ${moduleId}:`, err)
    log.error(`❌ Error stack:`, err.stack)
    try {
      await ModuleService.updateModuleStatus(
        moduleId,
        'FAILED',
        0,
        err?.message || 'processing failed'
      )
    } catch (statusErr) {
      log.error(`⚠️ Failed to update status for ${moduleId}:`, statusErr)
    }
    return res.status(500).json({ error: 'processing failed', details: err.message })
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

// Test endpoint for manual processing (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-process/:moduleId', async (req, res) => {
    const { moduleId } = req.params
    try {
      log.info(`🧪 Test processing for ${moduleId}`)
      
      // Check if module exists and has required fields
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        select: { id: true, status: true, s3Key: true, stepsKey: true }
      })
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }
      
      log.info(`📋 Module details:`, module)
      
      // Try to start processing
      const result = await startProcessing(moduleId)
      res.json({ success: true, result, module })
    } catch (err: any) {
      log.error(`❌ Test processing failed:`, err)
      res.status(500).json({ error: 'Test processing failed', details: err.message, stack: err.stack })
    }
  })
}

export { router as workerRoutes }
