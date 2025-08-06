import express from 'express'
import { processVideoJob } from '../services/qstashQueue.js'
import crypto from 'crypto'

const router = express.Router()

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

// QStash worker endpoint for processing video jobs
router.post('/process-video', async (req, res) => {
  try {
    console.log('📥 QStash worker received request:', req.body)
    
    // Verify QStash signature for security
    if (!isSignatureValid(req)) {
      console.warn('🔒 Invalid QStash signature')
      return res.status(401).send('Invalid signature')
    }
    
    const { moduleId, videoUrl } = req.body
    
    if (!moduleId || !videoUrl) {
      console.error('❌ Missing required fields:', { moduleId, videoUrl })
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['moduleId', 'videoUrl'],
        received: Object.keys(req.body)
      })
    }
    
    console.log(`🎬 [${moduleId}] Starting video processing via QStash worker`)
    
    // Process the video job
    await processVideoJob({ moduleId, videoUrl })
    
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

// Alternative QStash endpoint (as suggested in example)
router.post('/internal/qstash-process', async (req, res) => {
  try {
    console.log('📥 QStash worker received request (internal):', req.body)
    
    // Verify QStash signature for security
    if (!isSignatureValid(req)) {
      console.warn('🔒 Invalid QStash signature')
      return res.status(401).send('Invalid signature')
    }
    
    const { moduleId, videoUrl } = req.body
    
    if (!moduleId || !videoUrl) {
      console.error('❌ Missing required fields:', { moduleId, videoUrl })
      return res.status(400).send('Missing required fields')
    }
    
    console.log(`🎬 [${moduleId}] Starting video processing via QStash worker (internal)`)
    
    // Process the video job
    await processVideoJob({ moduleId, videoUrl })
    
    console.log(`✅ [${moduleId}] Video processing completed successfully`)
    
    // Return simple OK response as QStash expects
    res.status(200).send('OK')
    
  } catch (error) {
    console.error('❌ QStash worker error (internal):', error)
    res.status(500).send('Job failed')
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