import { startProcessing } from './ai/aiPipeline.js'

// QStash configuration
const QSTASH_ENDPOINT = process.env.QSTASH_ENDPOINT || 'https://qstash.upstash.io/v1/publish'
const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const BACKEND_URL = process.env.BACKEND_ORIGIN || 'http://localhost:3000'
const WORKER_JOB_SECRET = process.env.WORKER_JOB_SECRET

/**
 * Check if QStash is enabled
 */
export function isEnabled(): boolean {
  return !!QSTASH_TOKEN
}

/**
 * Enqueue a module for processing via QStash
 */
export async function enqueueProcessModule(moduleId: string): Promise<string | null> {
  if (!QSTASH_TOKEN) {
    console.log('⚠️ QStash not configured, falling back to direct processing')
    return null
  }

  try {
    const targetUrl = `${BACKEND_URL}/api/worker/process/${moduleId}`
    console.log('📬 Publishing to QStash:', { moduleId, targetUrl })
    
    const res = await fetch(`${QSTASH_ENDPOINT}`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${QSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        url: targetUrl,
        body: JSON.stringify({ moduleId }),
        headers: {
          'x-job-secret': WORKER_JOB_SECRET || ''
        }
      })
    })
    
    const text = await res.text()
    console.log('QStash publish result', { status: res.status, body: text, moduleId })
    
    if (!res.ok) {
      throw new Error(`QStash publish failed: ${res.status} ${text}`)
    }
    
    const result = JSON.parse(text)
    return result.message_id ?? null
  } catch (error) {
    console.error('❌ Failed to enqueue via QStash:', error)
    throw error
  }
}

/**
 * Process a module directly (fallback when QStash is not available)
 */
export async function processModuleDirectly(moduleId: string): Promise<void> {
  console.log('🔄 Processing module directly:', moduleId)
  await startProcessing(moduleId)
}