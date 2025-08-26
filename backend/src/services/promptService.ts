import { Retrieved } from './retrievalService.js';

export class PromptService {
  
  /**
   * Build RAG prompt with guardrails
   */
  static buildRagPrompt(
    question: string, 
    context: Retrieved[], 
    stepCount: number,
    currentStepIndex?: number
  ): { system: string; user: string } {
    
    // Format context snippets
    const contextLines = context.map((c, i) => {
      const meta = c.meta;
      let metaStr = '';
      
      if (c.kind === 'step' && meta.index) {
        metaStr = ` (Step ${meta.index})`;
      } else if (meta.start && meta.end) {
        metaStr = ` (${Math.round(meta.start)}s-${Math.round(meta.end)}s)`;
      }
      
      return `[${i + 1}|${c.kind.toUpperCase()}]${metaStr} ${c.text}`;
    });

    // Build system prompt with guardrails
    const system = `You are an AI trainer for a specific how-to module.

IMPORTANT RULES:
- ONLY use the provided context. Do NOT invent steps or information.
- If unsure, say which step numbers are most relevant and suggest seeking.
- Prefer citing "Step X" when applicable.
- Keep answers brief (2-5 sentences).
- Focus on practical, actionable guidance.
- If the question is unclear, ask for clarification or suggest related steps.`;

    // Build user prompt with context
    const user = `Question: ${question}

Total steps: ${stepCount}${currentStepIndex != null ? `\nCurrent step: ${currentStepIndex + 1}` : ''}

Context snippets:
${contextLines.join('\n')}

Answer briefly using the training steps when relevant. If a specific step is applicable, start with "Step X: ..."`;

    return { system, user };
  }

  /**
   * Build fallback prompt for when RAG context is weak
   */
  static buildFallbackPrompt(
    question: string, 
    steps: any[], 
    currentStepIndex?: number
  ): { system: string; user: string } {
    
    const system = `You are an AI trainer for a how-to module. The user's question is unclear or doesn't match the available steps well.

IMPORTANT RULES:
- Be helpful but honest about limitations.
- Suggest specific step numbers they can ask about.
- Provide general guidance if possible.
- Keep answers brief and encouraging.`;

    const user = `Question: ${question}

Available steps: ${steps.length} total${currentStepIndex != null ? `\nUser is currently on step: ${currentStepIndex + 1}` : ''}

The question doesn't clearly match any specific step. Please:
1. Acknowledge the limitation
2. Suggest asking about a specific step number (e.g., "What is step 3?")
3. Provide any general guidance you can
4. Keep it encouraging and helpful`;

    return { system, user };
  }

  /**
   * Build enhanced prompt for AI service
   */
  static buildEnhancedPrompt(
    question: string,
    context: Retrieved[],
    steps: any[],
    currentStepIndex?: number,
    videoTime?: number
  ): string {
    
    const contextInfo = context.length > 0 
      ? `\n\nRelevant context:\n${context.map((c, i) => `${i + 1}. ${c.source}: ${c.text}`).join('\n')}`
      : '';
    
    const stepInfo = steps.length > 0
      ? `\n\nAvailable steps:\n${steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')}`
      : '';
    
    const timeInfo = videoTime != null ? `\n\nCurrent video time: ${Math.round(videoTime)}s` : '';
    const currentInfo = currentStepIndex != null ? `\n\nUser is currently on step: ${currentStepIndex + 1}` : '';
    
    return `You are an AI trainer for a specific how-to module. Answer the user's question using the provided context and steps.

Question: ${question}${contextInfo}${stepInfo}${timeInfo}${currentInfo}

Instructions:
- Use the context and steps to provide accurate, helpful answers
- Cite specific step numbers when relevant
- Keep answers concise and practical
- If the question is unclear, suggest asking about specific steps`;
  }
}
