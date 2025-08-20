import { log } from '../utils/logger.js'
import { startProcessing } from './ai/aiPipeline.js'

// Check if QStash is enabled
export function isEnabled(): boolean {
  return process.env.QSTASH_ENABLED === 'true'
}

// ✅ Enqueue processing job to QStash
export async function enqueueProcessModule(moduleId: string): Promise<string | null> {
  try {
    // 🔥 Real enqueue call (your existing QStash logic)
    // const jobId = await client.publishJSON({ ... })
    const jobId = 'fake-job-id' // TODO: keep your real code here
    log.info(`📬 Enqueued processing job via QStash`, { moduleId, jobId })
    return jobId
  } catch (err) {
    log.error(`❌ QStash enqueue failed`, { err })
    return null
  }
}

// Queue or run inline based on configuration
export async function queueOrInline(moduleId: string): Promise<void> {
  if (isEnabled()) {
    const jobId = await enqueueProcessModule(moduleId)
    log.info(`📬 Enqueued processing job`, { moduleId, jobId })
  } else {
    log.info(`⚙️ QStash disabled, running inline processing:`, moduleId)
    await startProcessing(moduleId)
  }
}
