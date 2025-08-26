import type { Retrieved } from './retrievalService.js'

export class PromptService {
  /**
   * Build RAG prompt with guardrails
   */
  static buildRagPrompt(
    question: string, 
    context: Retrieved[], 
    stepCount: number,
    currentStepIndex?: number,
    currentTime?: number
  ) {
    const contextLines = context.map((c, i) => `[${i + 1}|${c.kind}] ${c.text}`)
    
    const systemPrompt = `You are an AI trainer for a specific how-to module.

IMPORTANT RULES:
- ONLY use the provided context. Do NOT invent steps or information.
- If unsure, say which step numbers are most relevant and suggest seeking clarification.
- Prefer citing "Step X" when applicable.
- Keep answers brief (2-5 sentences).
- If the context doesn't contain the answer, say so clearly.`

    const userPrompt = `Question: ${question}
Total steps: ${stepCount}${currentStepIndex !== undefined ? `\nCurrent step: ${currentStepIndex + 1}` : ''}${currentTime !== undefined ? `\nVideo time: ${Math.round(currentTime)}s` : ''}

Context snippets:
${contextLines.join('\n')}

Answer briefly using only the provided context. If a specific step is relevant, start with "Step X: ...".`

    return { system: systemPrompt, user: userPrompt }
  }

  /**
   * Build enhanced prompt for AI service
   */
  static buildEnhancedPrompt(
    question: string,
    context: Retrieved[],
    steps: any[],
    currentStepIndex?: number,
    currentTime?: number
  ) {
    const { system, user } = this.buildRagPrompt(question, context, steps.length, currentStepIndex, currentTime)
    
    // Add step list for additional context
    const stepList = steps.map((s, i) => `${i + 1}. ${s.title || s.description || `Step ${i + 1}`}`).join('\n')
    
    return {
      system,
      user: `${user}

Available steps:
${stepList}`
    }
  }

  /**
   * Build fallback prompt when RAG context is weak
   */
  static buildFallbackPrompt(question: string, steps: any[], currentStepIndex?: number) {
    const stepList = steps.map((s, i) => `${i + 1}. ${s.title || s.description || `Step ${i + 1}`}`).join('\n')
    
    return {
      system: `You are an AI trainer. Answer based on the available steps only. If you can't answer from the steps, suggest asking about a specific step number.`,
      user: `Question: ${question}
Current step: ${currentStepIndex !== undefined ? currentStepIndex + 1 : 'unknown'}

Available steps:
${stepList}

Answer briefly using only the step information above.`
    }
  }
}
