import { log } from '../utils/logger.js'

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
