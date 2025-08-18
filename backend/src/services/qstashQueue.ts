import { startProcessing } from './ai/aiPipeline.js'
import { Client } from '@upstash/qstash'

// QStash configuration
const QSTASH_ENABLED = (process.env.QSTASH_ENABLED || '').toLowerCase() === 'true'
const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const BACKEND_URL = process.env.BACKEND_ORIGIN || 'http://localhost:3000'
const WORKER_JOB_SECRET = process.env.WORKER_JOB_SECRET

// Initialize QStash V2 client
const qstash = QSTASH_ENABLED && QSTASH_TOKEN ? new Client({ token: QSTASH_TOKEN! }) : null

/**
 * Check if QStash is enabled
 */
export function isEnabled(): boolean {
  return QSTASH_ENABLED && !!QSTASH_TOKEN
}

/**
 * Enqueue a module for processing via QStash V2
 */
export async function enqueueProcessModule(moduleId: string): Promise<string | null> {
  if (!QSTASH_ENABLED) {
    throw new Error('QSTASH_DISABLED')
  }
  
  if (!qstash) {
    console.log('⚠️ QStash not configured, falling back to direct processing')
    return null
  }

  try {
    const targetUrl = `${BACKEND_URL}/api/worker/process`
    console.log('📬 Publishing to QStash V2:', { moduleId, targetUrl })
    
    const result = await qstash.publishJSON({
      url: targetUrl,
      body: { moduleId },
    })
    
    console.log('✅ QStash V2 publish successful:', { messageId: result.messageId, moduleId })
    return result.messageId ?? null
  } catch (error) {
    console.error('❌ Failed to enqueue via QStash V2:', error)
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