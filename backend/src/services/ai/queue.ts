// backend/src/services/ai/queue.ts
let busy = false
const wait = () => new Promise<void>(r => setTimeout(r, 250))

export async function runOneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  while (busy) await wait()
  busy = true
  try { return await fn() } finally { busy = false }
}
