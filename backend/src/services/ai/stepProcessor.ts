// backend/src/services/ai/stepProcessor.ts
export interface RawStep {
  id?: string
  title: string
  description?: string
  start?: number | string
  end?: number | string
}

const toSeconds = (v: number | string | undefined): number | undefined => {
  if (v == null) return undefined
  if (typeof v === 'number') return v
  // mm:ss format
  const match = String(v).trim().match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/)
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function normalizeSteps(
  steps: RawStep[],
  videoDuration: number
): RawStep[] {
  if (!Array.isArray(steps) || steps.length === 0) return []

  // 1. Parse and sort
  const parsed = steps
    .map((s) => {
      const start = toSeconds(s.start) ?? 0
      const endFromField = toSeconds(s.end)
      return { ...s, start, end: endFromField }
    })
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))

  // 2. Fill missing ends from next start or video duration
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end == null) {
      parsed[i].end =
        i < parsed.length - 1
          ? parsed[i + 1].start
          : videoDuration
    }
  }

  // 3. Clamp and ensure start < end
  for (const s of parsed) {
    s.start = Math.max(0, Math.min(videoDuration, s.start ?? 0))
    s.end = Math.max(s.start, Math.min(videoDuration, s.end ?? videoDuration))
  }

  return parsed
}

// Guard against uniform spacing placeholders
export function looksUniform(steps: {start:number; end:number}[], dur: number) {
  if (steps.length < 2) return false;
  const buckets = steps.map(s => +(s.end - s.start).toFixed(2));
  const uniq = new Set(buckets);
  return uniq.size === 1 && Math.abs(steps[0].start) < 0.01 && Math.abs(steps.at(-1)!.end - dur) < 0.5;
}

