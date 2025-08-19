// backend/src/services/qstashQueue.ts
import { startProcessing } from './ai/aiPipeline.js'
import { Client } from '@upstash/qstash'
import { log } from '../utils/logger.js'

// QStash configuration
const QSTASH_ENABLED = (process.env.QSTASH_ENABLED || '').toLowerCase() === 'true'
const QSTASH_TOKEN = process.env.QSTASH_TOKEN
const BACKEND_URL = process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 8000}`

// Initialize QStash V2 client if enabled
const qstash = QSTASH_ENABLED && QSTASH_TOKEN ? new Client({ token: QSTASH_TOKEN }) : null

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
  if (!isEnabled()) {
    throw new Error('QSTASH_DISABLED')
  }

  if (!qstash) {
    log.warn('⚠️ QStash client not configured, falling back to direct processing')
    return null
  }

  try {
    const targetUrl = `${BACKEND_URL}/api/worker/process`
    log.info('📬 Publishing to QStash V2', { moduleId, targetUrl })

    const result = await qstash.publishJSON({
      url: targetUrl,
      body: { moduleId },
    })

    log.info('✅ QStash V2 publish successful', { messageId: result.messageId, moduleId })
    return result.messageId ?? null
  } catch (error) {
    log.error('❌ Failed to enqueue via QStash V2', error)
    throw error
  }
}

/**
 * Process a module directly (fallback when QStash is not available)
 */
export async function processModuleDirectly(moduleId: string): Promise<void> {
  log.info('🔄 Processing module directly', { moduleId })
  await startProcessing(moduleId)
}

/**
 * Queue or process inline based on QStash availability
 */
export async function queueOrInline(moduleId: string): Promise<string | null> {
  if (isEnabled()) {
    try {
      const jobId = await enqueueProcessModule(moduleId)
      log.info('📬 Enqueued processing job', { moduleId, jobId })
      return jobId
    } catch (error) {
      log.warn('⚠️ QStash failed, falling back to inline processing', { moduleId, error })
      await processModuleDirectly(moduleId)
      return null
    }
  } else {
    log.info('⚙️ QStash disabled, running inline processing:', moduleId)
    await processModuleDirectly(moduleId)
    return null
  }
}
