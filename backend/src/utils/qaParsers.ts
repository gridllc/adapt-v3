s// QA Parsing Utilities
export function parseOrdinalQuery(question: string): number | null {
  const msg = question.toLowerCase().trim();
  
  // ordinals & numeric queries: "what's the 3rd step" / "step 3"
  const ord: Record<string, number> = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  };
  
  const wordKey = Object.keys(ord).find(w => 
    msg.includes(`${w} step`) || msg.includes(`the ${w} step`)
  );
  
  const numMatch = msg.match(/\bstep\s*(\d+)\b|\b(\d+)(?:st|nd|rd|th)?\s*step\b/);
  
  if (wordKey) return ord[wordKey];
  if (numMatch) return parseInt(numMatch[1] || numMatch[2], 10);
  
  return null;
}

export function parseStepCountQuery(question: string): boolean {
  const msg = question.toLowerCase().trim();
  return /how many steps|total steps|number of steps/.test(msg);
}

export function parseCurrentStepQuery(question: string): boolean {
  const msg = question.toLowerCase().trim();
  return /(current step|this step|what step am i on|which step)/.test(msg);
}

export function parseNavigationQuery(question: string): 'next' | 'previous' | null {
  const msg = question.toLowerCase().trim();
  if (msg.includes('next step')) return 'next';
  if (msg.includes('previous step') || msg.includes('last step')) return 'previous';
  return null;
}

export function parseTimingQuery(question: string): boolean {
  const msg = question.toLowerCase().trim();
  return /(time|duration|how long|length)/.test(msg);
}
