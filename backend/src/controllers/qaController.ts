import type { Request, Response } from 'express'
import { RetrievalService } from '../services/retrievalService.js'

export async function relatedQuestions(req: Request, res: Response) {
  const { moduleId, q } = req.query as { moduleId?: string; q?: string }
  if (!moduleId || !q) return res.status(400).json({ ok:false, error:'moduleId and q required' })
  const { strong } = await RetrievalService.getContextForQuestion(moduleId, q, 5)
  return res.json({ ok:true, items: strong.map(s => ({ kind: s.kind, text: s.text, meta: s.meta, score: s.score })) })
}
