import express from 'express'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { ModuleService } from '../services/moduleService.js'
import crypto from 'crypto'

const router = express.Router()

// optional shared secret to avoid public abuse
const JOB_SECRET = process.env.WORKER_JOB_SECRET

// QStash signature verification function
function isSignatureValid(req: express.Request): boolean {
  const signature = req.headers['upstash-signature']
  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY

  if (!signature || !signingKey) return false

  const bodyRaw = JSON.stringify(req.body)
  const hmac = crypto.createHmac('sha256', signingKey)
  hmac.update(bodyRaw)
  const expected = hmac.digest('base64')

  return signature === expected
}

// Main worker endpoint for processing modules (QStash V2)
router.post('/process', async (req, res) => {
  try {
    console.log('📥 QStash V2 worker received request:', req.body)
    
    // Verify QStash signature for security
    if (!isSignatureValid(req)) {
      console.warn('🔒 Invalid QStash signature')
      return res.status(401).send('Invalid signature')
    }
    
    const { moduleId } = req.body
    
    if (!moduleId) {
      console.error('❌ Missing moduleId:', req.body)
      return res.status(400).json({ 
        error: 'Missing moduleId',
        required: ['moduleId'],
        received: Object.keys(req.body)
      })
    }
    
    console.log(`🧵 [${moduleId}] Worker start`)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Worker processing started')
    await startProcessing(moduleId)
    console.log(`✅ [${moduleId}] Worker done`)
    
    // Return simple OK response as QStash expects
    res.status(200).send('OK')
    
  } catch (err: any) {
    console.error('❌ Worker process error:', err)
    const moduleId = req.body?.moduleId
    if (moduleId) {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0, err?.message || 'processing failed')
    }
    return res.status(500).json({ error: 'processing failed' })
  }
})

// Legacy endpoint for backward compatibility
router.post('/process/:moduleId', async (req, res) => {
  if (JOB_SECRET && req.get('x-job-secret') !== JOB_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { moduleId } = req.params

  try {
    console.log('🧵 Legacy worker start', { moduleId })
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Worker processing started')
    await startProcessing(moduleId)
    console.log('🧵 Legacy worker done', { moduleId })
    return res.json({ ok: true })
  } catch (err: any) {
    console.error('Legacy worker process error:', err)
    await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0, err?.message || 'processing failed')
    return res.status(500).json({ error: 'processing failed' })
  }
})

// QStash worker endpoint for processing video jobs (legacy compatibility)
router.post('/process-video', async (req, res) => {
  try {
    console.log('📥 QStash worker received request:', req.body)
    
    // Verify QStash signature for security
    if (!isSignatureValid(req)) {
      console.warn('🔒 Invalid QStash signature')
      return res.status(401).send('Invalid signature')
    }
    
    const { moduleId, videoUrl } = req.body
    
    if (!moduleId) {
      console.error('❌ Missing moduleId:', { moduleId, videoUrl })
      return res.status(400).json({ 
        error: 'Missing moduleId',
        required: ['moduleId'],
        received: Object.keys(req.body)
      })
    }
    
    console.log(`🎬 [${moduleId}] Starting video processing via QStash worker`)
    
    // Process the video job using the new pipeline
    await startProcessing(moduleId)
    
    console.log(`✅ [${moduleId}] Video processing completed successfully`)
    
    // Return simple OK response as QStash expects
    res.status(200).send('OK')
    
  } catch (error) {
    console.error('❌ QStash worker error:', error)
    
    res.status(500).json({ 
      error: 'Video processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
})

// Health check for QStash worker
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'qstash-worker',
    timestamp: new Date().toISOString()
  })
})

export { router as workerRoutes } 