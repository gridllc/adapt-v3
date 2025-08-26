export function buildRagPrompt(question: string, stepCount: number, ctx: Array<{ kind: string, text: string }>) {
  const snippets = ctx.map((c, i) => `[${i+1}|${c.kind}] ${c.text}`).join('\n')
  const system = `You are an AI trainer for a specific how-to module.
- ONLY use the provided context; do not invent steps.
- Prefer citing "Step N" when applicable.
- Keep answers concise (2–5 sentences).`
  const user = `Question: ${question}
Total steps: ${stepCount}
Context:
${snippets}`

  return { system, user }
}
