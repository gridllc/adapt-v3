import type { Request, Response } from 'express';
import { aiService } from '../services/aiService.js';
import { prisma } from '../config/database.js';
import { isPlaceholderResponse } from '../utils/placeholder.js';
import { RetrievalService } from '../services/retrievalService.js';
import { PromptService } from '../services/promptService.js';

type AskBody = {
  moduleId: string;
  question: string;
  // frontend context (all optional but powerful)
  currentTime?: number;            // seconds in player
  currentStepIndex?: number;       // 0-based
  totalSteps?: number;
  visibleSteps?: Array<{ id: string; text: string; start?: number; end?: number; aliases?: string[] }>;
};

export async function answerQuestion(req: Request, res: Response) {
  try {
    const { moduleId, question, currentTime, currentStepIndex, totalSteps, visibleSteps } =
      (req.body || {}) as AskBody;

    if (!moduleId || !question) {
      return res.status(400).json({ ok: false, error: 'moduleId and question required' });
    }

    console.log(`🤖 AI ask request for module ${moduleId}`);
    console.log(`📝 Question: "${question}"`);
    console.log(`🎬 Context: time=${currentTime}s, step=${currentStepIndex}, total=${totalSteps}`);

    // 1) Load steps once
    let steps: any[] = [];
    if (visibleSteps?.length) {
      steps = visibleSteps;
    } else {
      try {
        const dbSteps = await prisma.step.findMany({
          where: { moduleId },
          orderBy: { order: 'asc' },
          select: { id: true, text: true, startTime: true, endTime: true, aliases: true },
        });
        steps = dbSteps.map((s, i) => ({
          id: s.id,
          text: s.text,
          start: s.startTime,
          end: s.endTime,
          aliases: s.aliases || [],
          order: i + 1
        }));
      } catch (error) {
        console.warn('⚠️ Failed to fetch steps from DB:', error);
        return res.status(500).json({ ok: false, error: 'Failed to load steps' });
      }
    }

    if (!steps.length) {
      return res.status(404).json({ ok: false, error: 'No steps found for this module' });
    }

    // 2) Intent router (cheap + deterministic)
    const q = question.trim().toLowerCase();

    // how many steps?
    if (/(how many|count).*(step|steps)/.test(q)) {
      return res.json({ 
        ok: true, 
        source: 'RULES_COUNT', 
        answer: `There are **${steps.length}** steps in this training.` 
      });
    }

    // what step am I on?
    if (/what (step am i on|step number)/.test(q)) {
      const idx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps);
      if (idx != null) {
        return res.json({ 
          ok: true, 
          source: 'RULES_CURRENT', 
          answer: `You're on **Step ${idx + 1}**: ${steps[idx].text}` 
        });
      }
    }

    // next / previous step
    if (/^next( step)?$/.test(q) || /go to next/.test(q)) {
      const idx = Math.min((currentStepIndex ?? inferIndexFromTimeOrCurrent(currentTime, undefined, steps) ?? -1) + 1, steps.length - 1);
      return res.json({ 
        ok: true, 
        source: 'RULES_NEXT', 
        answer: `**Step ${idx + 1}**: ${steps[idx].text}` 
      });
    }
    if (/^(prev|previous)( step)?$/.test(q)) {
      const idx = Math.max((currentStepIndex ?? inferIndexFromTimeOrCurrent(currentTime, undefined, steps) ?? 0) - 1, 0);
      return res.json({ 
        ok: true, 
        source: 'RULES_PREV', 
        answer: `**Step ${idx + 1}**: ${steps[idx].text}` 
      });
    }

    // nth step ( "what is the 3rd step", "step 2 please" )
    const n = parseOrdinal(q);
    if (n != null && steps[n - 1]) {
      return res.json({ 
        ok: true, 
        source: 'RULES_ORDINAL', 
        answer: `**Step ${n}**: ${steps[n - 1].text}` 
      });
    }

    // vague "how do i enter", "how do I plug it in" → map to current step + aliases/keywords
    if (/^how do i /.test(q) || /how .* (do|to)/.test(q)) {
      const idx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps) ?? 0;
      const best = keywordMatch(q, steps, idx);
      if (best) {
        return res.json({ 
          ok: true, 
          source: 'RULES_KEYWORD', 
          answer: `**Step ${best.index + 1}**: ${best.step.text}` 
        });
      }
    }

    // 3) RAG + AI (for random, process-specific questions)
    try {
      // Get context using RAG
      const { pool, strong } = await RetrievalService.getContextForQuestion(moduleId, question, 6);
      
      if (strong.length > 0) {
        // We have good context - try AI with RAG
        const enhancedPrompt = PromptService.buildEnhancedPrompt(
          question, 
          strong, 
          steps, 
          currentStepIndex, 
          currentTime
        );
        
        const aiText = await aiService.generateContextualResponse(question, {
          currentStep: currentStepIndex != null ? steps[currentStepIndex] : undefined,
          allSteps: steps,
          videoTime: currentTime || 0,
          moduleId,
          userId: undefined, // TODO: get from auth
        });

        if (aiText && !isPlaceholderResponse(aiText)) {
          // AI worked with RAG context
          return res.json({ 
            ok: true, 
            source: 'RAG+AI', 
            answer: aiText.trim(),
            cites: strong.slice(0, 3).map(c => c.source)
          });
        }
      }

      // RAG context was weak or AI failed - try basic AI
      const aiText = await aiService.generateContextualResponse(question, {
        currentStep: currentStepIndex != null ? steps[currentStepIndex] : undefined,
        allSteps: steps,
        videoTime: currentTime || 0,
        moduleId,
        userId: undefined, // TODO: get from auth
      });

      if (aiText && !isPlaceholderResponse(aiText)) {
        // Basic AI worked
        return res.json({ ok: true, source: 'AI', answer: aiText.trim() });
      }

      // AI failed or returned placeholder - fallback to keyword matching
      const best = keywordMatch(q, steps);
      if (best) {
        return res.json({ 
          ok: true, 
          source: 'FALLBACK_KEYWORD', 
          answer: `**Step ${best.index + 1}**: ${best.step.text}` 
        });
      }

      // Last resort - helpful suggestions
      const currentIdx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps) ?? 0;
      return res.json({
        ok: true,
        source: 'FALLBACK_EMPTY',
        answer: `I couldn't find that in the module. Try asking about a step number (e.g., "What is step ${currentIdx + 1}?") or a specific action (e.g., "insert the card").`
      });

    } catch (error) {
      console.warn('⚠️ AI service failed, using fallback:', error);
      
      // fallback: best keyword match anywhere
      const best = keywordMatch(q, steps);
      if (best) {
        return res.json({ 
          ok: true, 
          source: 'FALLBACK_KEYWORD', 
          answer: `**Step ${best.index + 1}**: ${best.step.text}` 
        });
      }
      
      // last resort
      const currentIdx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps) ?? 0;
      return res.json({
        ok: true,
        source: 'FALLBACK_EMPTY',
        answer: `I can't tell from that—try "What is step ${currentIdx + 1}?" or "Next step".`
      });
    }

  } catch (error) {
    console.error('❌ AI controller error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Internal server error' 
    });
  }
}

// ---------- helpers ----------
function parseOrdinal(q: string): number | null {
  const m1 = q.match(/(?:^|\s)(\d+)(?:st|nd|rd|th)?\s*step/); // "3rd step"
  if (m1) return parseInt(m1[1], 10);
  const m2 = q.match(/step\s*(\d+)/); // "step 3"
  if (m2) return parseInt(m2[1], 10);
  
  // Handle word ordinals
  const ordinals: Record<string, number> = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  };
  
  for (const [word, num] of Object.entries(ordinals)) {
    if (q.includes(`${word} step`) || q.includes(`the ${word} step`)) {
      return num;
    }
  }
  
  return null;
}

function inferIndexFromTimeOrCurrent(time?: number, cur?: number, steps?: any[]): number | undefined {
  if (typeof cur === 'number') return cur;
  if (typeof time === 'number' && steps?.length) {
    const i = steps.findIndex(s => 
      typeof s.start === 'number' && 
      typeof s.end === 'number' && 
      time >= s.start && 
      time <= s.end
    );
    return i >= 0 ? i : 0;
  }
  return undefined;
}

function keywordMatch(q: string, steps: Array<any>, seedIndex?: number) {
  const qn = q.toLowerCase();
  let best = { score: -1, index: 0, step: steps[0] };
  
  steps.forEach((s, i) => {
    const hay = [
      (s.text || '').toLowerCase(),
      ...(Array.isArray(s.aliases) ? s.aliases.map((a: string) => a.toLowerCase()) : []),
    ].join(' ');
    
    const score = overlap(qn, hay) + (i === seedIndex ? 0.15 : 0); // slight bias to current step
    if (score > best.score) best = { score, index: i, step: s };
  });
  
  return best.score > 0.1 ? best : null; // threshold to avoid noise
}

function overlap(a: string, b: string): number {
  const A = new Set(a.split(/\W+/).filter(Boolean));
  const B = new Set(b.split(/\W+/).filter(Boolean));
  let hit = 0;
  A.forEach(w => { if (B.has(w)) hit++; });
  return hit / Math.max(A.size, 1);
} 