export const StepsService = {
  /**
   * Very naive chunker: split transcript into ~3–4 sentence blocks.
   */
  async buildFromTranscript(text: string) {
    const cleaned = (text || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return [];

    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const blocks: string[] = [];
    let cur: string[] = [];

    for (const s of sentences) {
      cur.push(s);
      if (cur.join(" ").length > 240) {
        blocks.push(cur.join(" "));
        cur = [];
      }
    }
    if (cur.length) blocks.push(cur.join(" "));

    return blocks.map((b, i) => ({
      order: i + 1,
      text: b,
      startTime: i * 8,      // best-effort placeholders
      endTime: i * 8 + 7,
    }));
  },
};
