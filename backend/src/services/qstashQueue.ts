import fetch from 'node-fetch'
import { startProcessing } from './ai/aiPipeline.js'
import { log } from '../utils/logger.js'
import crypto from 'crypto'

const QSTASH_URL = process.env.QSTASH_URL || 'https://qstash.upstash.io/v2/publish'
const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const QSTASH_ENABLED = process.env.QSTASH_ENABLED === 'true'
const BACKEND_URL = process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 8000}`
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY

export function isEnabled() {
  return QSTASH_ENABLED && !!QSTASH_TOKEN
}

// Verify QStash webhook signature
export function verifyQStashWebhook(req: any): boolean {
  if (!QSTASH_CURRENT_SIGNING_KEY && !QSTASH_NEXT_SIGNING_KEY) {
    log.warn('⚠️ No QStash signing keys configured, skipping verification')
    return true
  }

  const signature = req.headers['upstash-signature']
  const timestamp = req.headers['upstash-timestamp']
  
  if (!signature || !timestamp) {
    log.warn('⚠️ Missing QStash signature headers')
    return false
  }

  const body = JSON.stringify(req.body)
  const message = `${timestamp}.${body}`
  
  // Try current signing key first, then next
  const keys = [QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY].filter(Boolean)
  
  for (const key of keys) {
    if (key) {
      const expectedSignature = crypto
        .createHmac('sha256', key)
        .update(message)
        .digest('hex')
      
      if (crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        return true
      }
    }
  }
  
  log.warn('⚠️ QStash signature verification failed')
  return false
}

// Enqueue a processing job for a module
export async function enqueueProcessModule(moduleId: string) {
  if (!isEnabled()) {
    console.log('⚠️ QStash disabled, skipping enqueue:', moduleId)
    return null
  }

  try {
    const url = `${QSTASH_URL}`
    const targetUrl = `${BACKEND_URL}/api/worker/process`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Forward': targetUrl,
      },
      body: JSON.stringify({ moduleId }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`QStash enqueue failed: ${res.status} ${text}`)
    }

    const data = await res.json() as { messageId?: string }
    console.log('📬 Enqueued module for processing:', { moduleId, jobId: data.messageId })
    return data.messageId || null
  } catch (err) {
    console.error('❌ Failed to enqueue QStash job:', err)
    throw err
  }
}
