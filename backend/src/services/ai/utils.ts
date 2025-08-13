/**
 * Smart transcript trimming utility to reduce AI processing costs
 * Caps transcript length while preserving important context from start and end
 */

export function smartTrimTranscript(text: string, cap = 10000) {
  if (!text || text.length <= cap) return text;
  
  const head = Math.floor(cap * 0.25);  // 25% from start
  const tail = Math.floor(cap * 0.25);  // 25% from end
  const mid = cap - head - tail;        // 50% from middle

  const start = text.slice(0, head);
  const end = text.slice(-tail);
  const middle = text.slice(head, text.length - tail);

  // Sample middle section to fit within remaining space
  const step = Math.max(1, Math.floor(middle.length / mid));
  let sampled = '';
  for (let i = 0; i < middle.length && sampled.length < mid; i += step) {
    sampled += middle[i];
  }

  return `${start}\n…[omitted for brevity]…\n${sampled}\n…[omitted]…\n${end}`;
}

/**
 * Get transcript cap from environment or use default
 */
export function getTranscriptCap(): number {
  return Number(process.env.MAX_TRANSCRIPT_CHARS ?? 10000);
}

/**
 * Check if transcript needs trimming
 */
export function needsTrimming(text: string): boolean {
  if (!text) return false;
  return text.length > getTranscriptCap();
}
