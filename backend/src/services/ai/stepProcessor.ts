// backend/src/services/ai/stepProcessor.ts
export type RawStep = {
  id?: string;
  title: string;
  description?: string;
  start?: number | string; // sec or mm:ss
  end?: number | string;   // sec or mm:ss
  // ...anything else
};

const toSec = (v: number | string | undefined): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  // mm:ss -> seconds
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  // numeric string
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function normalizeStepTimings(steps: RawStep[], videoDurationSec: number): RawStep[] {
  const clamp = (x: number) => Math.max(0, Math.min(videoDurationSec, x));

  // 1) parse + sort by start
  const parsed = steps
    .map(s => {
      const start = toSec(s.start) ?? 0;
      const endFromField = toSec(s.end);
      return { ...s, start, end: endFromField };
    })
    .sort((a, b) => a.start - b.start);

  // 2) infer any missing end from next.start or video end
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end == null) {
      parsed[i].end = i < parsed.length - 1 ? parsed[i + 1].start : videoDurationSec;
    }
  }

  // 3) clamp + fix inversions
  for (let i = 0; i < parsed.length; i++) {
    const s = clamp(parsed[i].start!);
    const e = clamp(parsed[i].end!);
    parsed[i].start = Math.min(s, e);
    parsed[i].end = Math.max(s, e);
  }

  // 4) collapse accidental overlaps by nudging starts forward
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].start! < parsed[i - 1].end!) {
      parsed[i].start = parsed[i - 1].end;
    }
  }

  return parsed;
}

// Guard against uniform spacing placeholders
export function looksUniform(steps: {start:number; end:number}[], dur: number) {
  if (steps.length < 2) return false;
  const buckets = steps.map(s => +(s.end - s.start).toFixed(2));
  const uniq = new Set(buckets);
  return uniq.size === 1 && Math.abs(steps[0].start) < 0.01 && Math.abs(steps.at(-1)!.end - dur) < 0.5;
}
