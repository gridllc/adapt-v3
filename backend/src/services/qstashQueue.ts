import { startProcessing } from './ai/aiPipeline.js'

export function isEnabled() {
  return !!process.env.QSTASH_TOKEN && process.env.QSTASH_ENABLED !== 'false'
}

export async function queueOrInline(moduleId: string) {
  try {
    if (isEnabled()) {
      console.log(`📬 [${moduleId}] QStash enabled, attempting to enqueue...`)
      const { Client } = await import('@upstash/qstash')
      const c = new Client({
        token: process.env.QSTASH_TOKEN!,
      })
      const dest = process.env.QSTASH_DESTINATION_URL // your /api/worker/process
      if (!dest) {
        console.warn(`⚠️ [${moduleId}] Missing QSTASH_DESTINATION_URL, falling back to inline`)
        await startProcessing(moduleId)
        return
      }

      const r = await c.publishJSON({
        url: dest,
        body: { moduleId },
      })
      if (!r.messageId) {
        console.warn(`⚠️ [${moduleId}] No messageId returned from QStash, falling back to inline`)
        await startProcessing(moduleId)
        return
      }
      console.log(`📬 [${moduleId}] Enqueued job successfully`, { moduleId, messageId: r.messageId })
      return
    }
    
    // QStash disabled, run inline
    console.log(`⚙️ [${moduleId}] QStash disabled → running inline processing`)
    await startProcessing(moduleId)
  } catch (err) {
    console.warn(`⚠️ [${moduleId}] QStash enqueue failed → INLINE FALLBACK`, { moduleId, error: err })
    console.log(`🔄 [${moduleId}] Falling back to inline processing due to QStash error`)
    await startProcessing(moduleId)
  }
}
