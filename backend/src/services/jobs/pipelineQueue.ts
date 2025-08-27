import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });
const BASE = process.env.PUBLIC_BASE_URL!; // e.g. https://adapt-v3.onrender.com

export async function enqueuePipeline(moduleId: string, s3Key: string) {
  const url = `${BASE}/api/qstash/pipeline`;
  const dedup = `pipeline:${moduleId}:${s3Key}`; // any stable string within 10m window

  return client.publishJSON({
    url,
    body: { moduleId, s3Key },
    headers: {
      // prevents duplicate enqueues within ~10 minutes
      "Upstash-Deduplication-Id": dedup,
      // control delivery retries from QStash side
      "Upstash-Retries": "6",
      // optional delivery reports (great for Render "why failed?")
      "Upstash-Callback": `${BASE}/api/qstash/success`,
      "Upstash-Failure-Callback": `${BASE}/api/qstash/failure`,
    },
    delay: "2s", // tiny buffer to avoid hot path spikes
  });
}
