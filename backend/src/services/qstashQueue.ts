import { startProcessing } from './ai/aiPipeline.js'
import { log } from '../utils/logger.js'

const useQstash = process.env.USE_QSTASH === 'true'

// ✅ Enqueue processing job (or fallback inline)
export async function enqueueProcessModule(moduleId: string) {
  if (useQstash) {
    try {
      // 🔥 Real enqueue call (your existing QStash logic)
      // const jobId = await client.publishJSON({ ... })
      const jobId = 'fake-job-id' // TODO: keep your real code here
      log.info(`📬 Enqueued processing job via QStash`, { moduleId, jobId })
      return jobId
    } catch (err) {
      log.error(`❌ QStash enqueue failed, falling back inline`, { err })
      await startProcessing(moduleId)
    }
  } else {
    // 🚫 Skip enqueue — run inline for dev/debug
    log.info(`⚙️ USE_QSTASH=false → processing inline`, { moduleId })
    await startProcessing(moduleId)
  }
}
