export type Intent =
  | { type: 'NEXT'; confidence?: number; matched?: string; raw?: string }
  | { type: 'PREV'; confidence?: number; matched?: string; raw?: string }
  | { type: 'GOTO'; n: number; confidence?: number; matched?: string; raw?: string }
  | { type: 'WHICH'; confidence?: number; matched?: string; raw?: string }
  | { type: 'REPEAT'; confidence?: number; matched?: string; raw?: string }
  | { type: 'SUMMARY'; confidence?: number; matched?: string; raw?: string }
  | { type: 'EXPLAIN'; confidence?: number; matched?: string; raw?: string }
  | { type: 'PAUSE'; confidence?: number; matched?: string; raw?: string }
  | { type: 'RESUME'; confidence?: number; matched?: string; raw?: string }
  | { type: 'RESTART'; confidence?: number; matched?: string; raw?: string }
  | { type: 'SEEK_REL'; delta: number; confidence?: number; matched?: string; raw?: string }
  | { type: 'HELP'; confidence?: number; matched?: string; raw?: string }
  | { type: 'MUTE'; confidence?: number; matched?: string; raw?: string }
  | { type: 'UNMUTE'; confidence?: number; matched?: string; raw?: string };

const ORDINALS: Record<string, number> = {
  'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
  'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
  'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14,
  'fifteenth': 15, 'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18,
  'nineteenth': 19, 'twentieth': 20
};

const CARDINALS: Record<string, number> = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
  'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20
};

function normalize(t: string): string {
  // strip punctuation, collapse spaces, lowercase
  return t.toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPolite(t: string): string {
  // remove leading polite fillers that ASR often adds
  return t
    .replace(/^(please|hey|hi|okay|ok|could you|can you|would you|will you)\s+/g, '')
    .replace(/\s+please$/g, '')
    .trim();
}

function extractStepNumber(t: string): number | null {
  // digits: "step 5", "go to 12"
  const mDigits = t.match(/\b(?:step\s*)?#?\s*(\d{1,3})\b/);
  if (mDigits) return Number(mDigits[1]);

  // ordinals: "third step", "go to the fifth"
  for (const [word, n] of Object.entries(ORDINALS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n;
  }
  
  // cardinals spelled out: "step three"
  for (const [word, n] of Object.entries(CARDINALS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n;
  }
  
  return null;
}

function extractTimeDelta(t: string): number | null {
  // "forward 10 seconds", "back 5 seconds", "ahead 30", "behind 15"
  const forwardMatch = t.match(/\b(?:forward|ahead|fast|skip)\s+(\d+)\s*(?:seconds?|secs?)?\b/);
  if (forwardMatch) return Number(forwardMatch[1]);
  
  const backwardMatch = t.match(/\b(?:back|behind|rewind|reverse)\s+(\d+)\s*(?:seconds?|secs?)?\b/);
  if (backwardMatch) return -Number(backwardMatch[1]);
  
  // "10 seconds forward", "5 seconds back"
  const forwardMatch2 = t.match(/\b(\d+)\s*(?:seconds?|secs?)?\s+(?:forward|ahead|fast)\b/);
  if (forwardMatch2) return Number(forwardMatch2[1]);
  
  const backwardMatch2 = t.match(/\b(\d+)\s*(?:seconds?|secs?)?\s+(?:back|behind|rewind)\b/);
  if (backwardMatch2) return -Number(backwardMatch2[1]);
  
  return null;
}

function findMatchedPhrase(t: string, pattern: RegExp): string | undefined {
  const match = t.match(pattern);
  return match ? match[0] : undefined;
}

export function parseIntent(raw: string, totalSteps?: number): Intent | null {
  if (!raw) return null;
  
  const t0 = normalize(raw);
  const t = stripPolite(t0);
  const rawText = raw.trim();

  // Order matters: handle 'replay' before 'play'
  if (/\breplay\b|\brepeat\b|\bagain\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\breplay\b|\brepeat\b|\bagain\b/);
    return { type: 'REPEAT', confidence: 0.95, matched, raw: rawText };
  }

  if (/^(?:next|next step|go next|continue|proceed)\b/.test(t) || /\bnext\b/.test(t)) {
    const matched = findMatchedPhrase(t, /^(?:next|next step|go next|continue|proceed)\b|\bnext\b/);
    return { type: 'NEXT', confidence: 0.95, matched, raw: rawText };
  }

  // avoid matching 'preview'
  if (/^(?:previous|prev|go back|back|back one)\b/.test(t) || /\bprevious\b|\bgo back\b/.test(t)) {
    const matched = findMatchedPhrase(t, /^(?:previous|prev|go back|back|back one)\b|\bprevious\b|\bgo back\b/);
    return { type: 'PREV', confidence: 0.95, matched, raw: rawText };
  }

  // GOTO variants: "go to step 5", "jump to 3", "step seven", "skip to 12"
  if (/\b(go to|goto|jump to|skip to|take me to)\b/.test(t) || /\bstep\b/.test(t)) {
    const n = extractStepNumber(t);
    if (n !== null && n >= 0) {
      // Range/bounds check with confidence adjustment
      let confidence = 0.9;
      if (totalSteps && n > totalSteps) {
        confidence = 0.7; // Lower confidence when out of range
      }
      const matched = findMatchedPhrase(t, /\b(go to|goto|jump to|skip to|take me to)\b|\bstep\b/);
      return { type: 'GOTO', n, confidence, matched, raw: rawText };
    }
  }

  // SEEK_REL: "forward 10 seconds", "back 5 seconds"
  const timeDelta = extractTimeDelta(t);
  if (timeDelta !== null) {
    const matched = findMatchedPhrase(t, /\b(?:forward|ahead|fast|skip|back|behind|rewind|reverse)\s+\d+\s*(?:seconds?|secs?)?\b|\b\d+\s*(?:seconds?|secs?)?\s+(?:forward|ahead|fast|back|behind|rewind)\b/);
    return { type: 'SEEK_REL', delta: timeDelta, confidence: 0.9, matched, raw: rawText };
  }

  if (/\b(what|which)\b.*\b(step)\b|\bwhich step\b|\bwhat step\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\b(what|which)\b.*\b(step)\b|\bwhich step\b|\bwhat step\b/);
    return { type: 'WHICH', confidence: 0.9, matched, raw: rawText };
  }

  if (/\bsummary\b|\boverview\b|\bsummarize\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\bsummary\b|\boverview\b|\bsummarize\b/);
    return { type: 'SUMMARY', confidence: 0.9, matched, raw: rawText };
  }

  if (/\bexplain\b|\bmore detail\b|\btell me more\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\bexplain\b|\bmore detail\b|\btell me more\b/);
    return { type: 'EXPLAIN', confidence: 0.9, matched, raw: rawText };
  }

  if (/\bpause\b|\bstop\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\bpause\b|\bstop\b/);
    return { type: 'PAUSE', confidence: 0.95, matched, raw: rawText };
  }

  // ensure 'replay' already handled; 'play' here means resume
  if (/\bresume\b|\bplay\b|\bcontinue\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\bresume\b|\bplay\b|\bcontinue\b/);
    return { type: 'RESUME', confidence: 0.9, matched, raw: rawText };
  }

  // RESTART: "start over", "from the beginning", "restart"
  if (/\b(?:start over|from the beginning|restart|begin again|reset)\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\b(?:start over|from the beginning|restart|begin again|reset)\b/);
    return { type: 'RESTART', confidence: 0.9, matched, raw: rawText };
  }

  // HELP: "what can I say?", "help", "commands"
  if (/\b(?:what can I say|help|commands|what do I say|how do I use)\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\b(?:what can I say|help|commands|what do I say|how do I use)\b/);
    return { type: 'HELP', confidence: 0.9, matched, raw: rawText };
  }

  // MUTE/UNMUTE: "mute", "unmute", "turn off sound", "turn on sound"
  if (/\b(?:mute|turn off sound|silence|quiet)\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\b(?:mute|turn off sound|silence|quiet)\b/);
    return { type: 'MUTE', confidence: 0.9, matched, raw: rawText };
  }

  if (/\b(?:unmute|turn on sound|sound on|volume on)\b/.test(t)) {
    const matched = findMatchedPhrase(t, /\b(?:unmute|turn on sound|sound on|volume on)\b/);
    return { type: 'UNMUTE', confidence: 0.9, matched, raw: rawText };
  }

  return null;
}

// Utility function to get confidence level description
export function getConfidenceLevel(confidence?: number): 'high' | 'medium' | 'low' {
  if (!confidence) return 'low';
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.8) return 'medium';
  return 'low';
}

// Utility function to check if intent should be executed immediately
export function shouldExecuteIntent(intent: Intent, confidenceThreshold: number = 0.8): boolean {
  return (intent.confidence || 0) >= confidenceThreshold;
}

// Utility function to get disambiguation prompt
export function getDisambiguationPrompt(intent: Intent): string | null {
  if ((intent.confidence || 0) >= 0.8) return null;
  
  switch (intent.type) {
    case 'NEXT':
      return "Did you want 'next step' or 'repeat'?";
    case 'PREV':
      return "Did you want 'previous step' or 'pause'?";
    case 'GOTO':
      return `Did you want to go to step ${intent.n}?`;
    case 'PAUSE':
      return "Did you want 'pause' or 'previous'?";
    case 'RESUME':
      return "Did you want 'resume' or 'repeat'?";
    default:
      return "Could you please repeat that?";
  }
}
