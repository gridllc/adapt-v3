// Deterministic placeholder detection utility
const SENTINELS = [
  'enhanced ai contextual response service is not currently available',
  'temporarily unavailable',
  'service is not currently available',
  'enhanced ai contextual response service',
];

export function looksLikePlaceholder(text?: string): boolean {
  if (!text) return true;
  const t = text.trim().toLowerCase();

  // Extremely short or boilerplate apology
  if (t.length < 30 && (t.includes('sorry') || t.includes('unavailable'))) return true;

  // Known sentinel phrases
  if (SENTINELS.some(s => t.includes(s))) return true;

  // Overly meta phrasing often used by guards
  if (t.startsWith("i'm sorry") && t.includes('cannot')) return true;

  // Generic error messages
  if (t.includes('enhanced') && t.includes('not currently available')) return true;

  return false;
}

export function isPlaceholderResponse(text: string): boolean {
  return looksLikePlaceholder(text);
}
