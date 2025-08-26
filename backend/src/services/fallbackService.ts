import { prisma } from '../config/database.js';
import { 
  parseOrdinalQuery, 
  parseStepCountQuery, 
  parseCurrentStepQuery, 
 
parseNavigationQuery,
  parseTimingQuery 
} from '../utils/qaParsers.js';
import { FallbackResponse } from './ai/types.js';

export class FallbackService {
  
  /**
   * Rule-based step lookup for ordinal queries
   */
  static async handleOrdinalQuery(moduleId: string, ordinal: number): Promise<FallbackResponse | null> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, startTime: true, endTime: true },
      });
      
      const idx = ordinal - 1;
      if (steps[idx]) {
        const step = steps[idx];
        return {
          ok: true,
          source: 'RULES_STEP_LOOKUP',
          answer: `**Step ${ordinal}**: ${step.text}`,
          meta: { 
            start: step.startTime, 
            end: step.endTime, 
            stepId: step.id,
            stepNumber: ordinal 
          },
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch steps for ordinal query:', error);
    }
    return null;
  }

  /**
   * Handle step count queries
   */
  static async handleStepCountQuery(moduleId: string): Promise<FallbackResponse | null> {
    try {
      const count = await prisma.step.count({ where: { moduleId } });
      return {
        ok: true,
        source: 'RULES_STEP_LOOKUP',
        answer: `There are **${count}** steps in this training.`,
        meta: { stepCount: count },
      };
    } catch (error) {
      console.warn('⚠️ Failed to count steps:', error);
    }
    return null;
  }

  /**
   * Handle current step queries
   */
  static async handleCurrentStepQuery(moduleId: string, currentStep?: any): Promise<FallbackResponse | null> {
    if (!currentStep) {
      return {
        ok: true,
        source: 'FALLBACK_EMPTY',
        answer: "I don't know which step you're currently on. Try seeking to a specific step or ask about a step number.",
      };
    }

    return {
      ok: true,
      source: 'RULES_STEP_LOOKUP',
      answer: `You're on **Step ${currentStep.stepNumber}**: ${currentStep.title}${currentStep.description ? ` — ${currentStep.description}` : ''}`,
      meta: { 
        stepId: currentStep.id,
        stepNumber: currentStep.stepNumber,
        start: currentStep.start,
        end: currentStep.end 
      },
    };
  }

  /**
   * Handle navigation queries
   */
  static async handleNavigationQuery(moduleId: string, direction: 'next' | 'previous', currentStep?: any): Promise<FallbackResponse | null> {
    if (!currentStep) {
      return {
        ok: true,
        source: 'FALLBACK_EMPTY',
        answer: "I don't know which step you're on. Try seeking to a specific step first.",
      };
    }

    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, order: true },
      });

      const total = steps.length;
      let targetStep = null;

      if (direction === 'next' && currentStep.stepNumber < total) {
        targetStep = steps[currentStep.stepNumber];
      } else if (direction === 'previous' && currentStep.stepNumber > 1) {
        targetStep = steps[currentStep.stepNumber - 2];
      }

      if (targetStep) {
        return {
          ok: true,
          source: 'RULES_STEP_LOOKUP',
          answer: `${direction === 'next' ? 'Next' : 'Previous'} is **Step ${targetStep.order}**: "${targetStep.text}". Use "▶️ Seek" to jump there.`,
          meta: { 
            stepId: targetStep.id,
            stepNumber: targetStep.order,
            direction 
          },
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch steps for navigation:', error);
    }

    return {
      ok: true,
      source: 'FALLBACK_EMPTY',
      answer: `Use "▶️ Seek" on any step to navigate.`,
    };
  }

  /**
   * Handle timing queries
   */
  static async handleTimingQuery(moduleId: string, currentStep?: any): Promise<FallbackResponse | null> {
    if (currentStep) {
      const duration = Math.max(0, Math.round((currentStep.end || 0) - (currentStep.start || 0)));
      return {
        ok: true,
        source: 'RULES_STEP_LOOKUP',
        answer: `Step ${currentStep.stepNumber} lasts ~${duration}s.`,
        meta: { 
          stepId: currentStep.id,
          duration,
          start: currentStep.start,
          end: currentStep.end 
        },
      };
    }

    return {
      ok: true,
      source: 'FALLBACK_EMPTY',
      answer: "Each step shows its start time; use '▶️ Seek' to jump to any step.",
    };
  }

  /**
   * Keyword matching fallback
   */
  static async handleKeywordFallback(moduleId: string, question: string): Promise<FallbackResponse | null> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, order: true },
      });

      const best = this.keywordMatch(question, steps);
      if (best) {
        return {
          ok: true,
          source: 'FALLBACK_KEYWORD',
          answer: `**Step ${best.step.order}**: ${best.step.text}`,
          meta: { 
            stepId: best.step.id,
            stepNumber: best.step.order,
            score: best.score 
          },
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch steps for keyword fallback:', error);
    }
    return null;
  }

  /**
   * Simple keyword matching algorithm
   */
  private static keywordMatch(question: string, steps: Array<{ id: string; text: string; order: number }>) {
    const qn = question.toLowerCase();
    let best = null;
    
    for (const step of steps) {
      const score = this.simpleScore(qn, step.text.toLowerCase());
      if (!best || score > best.score) {
        best = { score, step, rendered: step.text };
      }
    }
    
    return best?.score && best.score > 0.1 ? best : null;
  }

  /**
   * Simple bag-of-words overlap scoring
   */
  private static simpleScore(a: string, b: string): number {
    const aw = new Set(a.split(/\W+/).filter(Boolean));
    const bw = new Set(b.split(/\W+/).filter(Boolean));
    
    if (aw.size === 0 || bw.size === 0) return 0;
    
    let hit = 0;
    for (const w of aw) {
      if (bw.has(w)) hit++;
    }
    
    return hit / Math.max(1, aw.size);
  }

  /**
   * Generate helpful suggestions
   */
  static getHelpfulSuggestions(): FallbackResponse {
    return {
      ok: true,
      source: 'FALLBACK_EMPTY',
      answer: "Try asking:\n• 'What is the 3rd step?'\n• 'How many steps are there?'\n• 'What step am I on?'\n• 'Next step?'",
    };
  }
}
