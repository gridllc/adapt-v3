// backend/src/config/env.ts
const required = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_BUCKET_NAME',
  'OPENAI_API_KEY',      // or GEMINI if you switch later
  'DATABASE_URL',
] as const;

type Key = typeof required[number];

export function ensureEnv() {
  const missing = required.filter(k => !process.env[k as Key]);
  if (missing.length) {
    const msg = `Missing env: ${missing.join(', ')}`;
    console.error(msg);
    throw new Error(msg);
  }
}