// backend/src/services/qstashQueue.ts
import fetch from "node-fetch"

const QSTASH_URL = process.env.QSTASH_URL || "https://qstash.upstash.io/v2/publish"
const QSTASH_TOKEN = process.env.QSTASH_TOKEN!

/**
 * Enqueue a background job to QStash
 */
export async function enqueueJob(jobName: string, payload: any) {
  if (!QSTASH_TOKEN) {
    console.warn("QStash disabled, job ran inline:", jobName)
    return runInline(jobName, payload)
  }

  const url = `${QSTASH_URL}/jobs/${jobName}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${QSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QStash enqueue failed: ${res.status} ${text}`)
  }

  return res.json()
}

// Fallback: run inline in dev if QStash disabled
async function runInline(jobName: string, payload: any) {
  if (jobName === "processVideo") {
    const { processVideoJob } = await import("../workers/processVideoJob.js")
    return processVideoJob(payload)
  }
  console.warn("No inline handler for job:", jobName)
}
