// services/ai/stepsService.ts
// Replace this with your Gemini/OpenAI prompt call when ready.
export async function generateStepsFromTranscript(text: string) {
  // very basic fallback: split into ~1-minute chunks
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    buf += (buf ? " " : "") + s;
    if (buf.length > 500) { chunks.push(buf); buf = ""; }
  }
  if (buf) chunks.push(buf);

  return chunks.map((c, i) => ({
    startTimeMs: i * 60_000,
    endTimeMs:   (i + 1) * 60_000,
    text: c
  }));
}
