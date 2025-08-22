const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10
};

export function extractStepNumber(q: string): number | null {
  const s = q.toLowerCase().trim();

  // "what's the 3rd step", "step 3", "3rd step", "tell me step 3"
  const mNum = s.match(/\bstep\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s+step\b/);
  if (mNum) return Number(mNum[1] ?? mNum[2]);

  // "what's the third step", "the second step"
  const mWord = s.match(
    new RegExp(`\\b(${Object.keys(ORDINALS).join("|")})\\s+step\\b`)
  );
  if (mWord) return ORDINALS[mWord[1]];

  return null;
}
