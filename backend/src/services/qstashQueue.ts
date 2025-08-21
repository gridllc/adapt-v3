import { startProcessing } from './ai/aiPipeline.js'

export function isEnabled() {
  return !!process.env.QSTASH_TOKEN && process.env.QSTASH_ENABLED !== 'false'
}

export async function queueOrInline(moduleId: string) {
  try {
    if (isEnabled()) {
s      const { Client } = await import('@upstash/qstash')
      const c = new Client({
        token: process.env.QSTASH_TOKEN!,
      })
      const dest = process.env.QSTASH_DESTINATION_URL // your /api/worker/process
      if (!dest) throw new Error('Missing QSTASH_DESTINATION_URL')

      const r = await c.publishJSON({
        url: dest,
        body: { moduleId },
      })
      if (!r.messageId) throw new Error('No messageId returned from QStash')
      console.log('📬 Enqueued job', { moduleId, messageId: r.messageId })
      return
    }
    // if disabled, run inline
    console.log('⚙️ QStash disabled → running inline', { moduleId })
    await startProcessing(moduleId)
  } catch (err) {
    console.warn('⚠️ Enqueue failed → INLINE FALLBACK', { moduleId, err })
    await startProcessing(moduleId)
  }
}
