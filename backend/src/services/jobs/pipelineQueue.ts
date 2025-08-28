import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN! });

// Get the base URL for webhook callbacks - tries multiple sources
export function getBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL ||
         process.env.RENDER_EXTERNAL_URL ||
         (process.env.RENDER_SERVICE_NAME ? `https://${process.env.RENDER_SERVICE_NAME}.onrender.com` : undefined) ||
         'https://adapt-v3.onrender.com'; // fallback to your known deployment
}

const BASE = getBaseUrl();

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
    delay: 2000, // 2 second buffer to avoid hot path spikes
  });
}
