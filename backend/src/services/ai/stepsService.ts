// Naive step generator: splits text into ~sentences and assigns rough 8–12s windows.
// Replace later with timestamped chapters when you enable diarization/word timings.

type StepLike = { text: string; startTime: number; endTime: number };

export function generateStepsFromTranscript(text: string): StepLike[] {
  const cleaned = (text || "").trim();
  if (!cleaned) return [];

  // Split on sentence-ish delimiters
  const parts = cleaned
    .split(/(?<=[\.!?])\s+/g)
    .map(s => s.trim())
    .filter(Boolean);

  if (!parts.length) return [];

  // Assign naive times: 10s per sentence
  const STEP_SEC = 10;
  let cursor = 0;
  const steps: StepLike[] = parts.map(p => {
    const start = cursor;
    const end = cursor + STEP_SEC;
    cursor = end;
    return { text: p, startTime: start, endTime: end };
  });

  return steps;
}
