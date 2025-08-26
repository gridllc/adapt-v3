import type { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { prisma } from '../config/database.js'
import { RetrievalService } from '../services/retrievalService.js'
import { PromptService } from '../services/promptService.js'
import { askAI } from '../services/aiService.js'
import { buildRagPrompt } from '../services/prompt.js'
import { logQA } from '../services/qaLogger.js'

type AskBody = {
  moduleId: string
  question: string
  // frontend context (all optional but powerful)
  currentTime?: number            // seconds in player
  currentStepIndex?: number       // 0-based
  totalSteps?: number
  visibleSteps?: Array<{ id:string; text:string; start?:number; end?:number; aliases?:string[] }>
}

export async function answerQuestion(req: Request, res: Response) {
  const { moduleId, question, currentTime, currentStepIndex, totalSteps, visibleSteps } =
    (req.body || {}) as AskBody

  if (!moduleId || !question) {
    return res.status(400).json({ ok:false, error:'moduleId and question required' })
  }

  // 1) Load steps once
  let steps: any[] = []
  if (visibleSteps?.length) {
    steps = visibleSteps
  } else {
    try {
      const dbSteps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, startTime: true, endTime: true, order: true },
      })
      steps = dbSteps.map((s, i) => ({
        id: s.id,
        text: s.text || `Step ${s.order}`,
        start: s.startTime,
        end: s.endTime,
        stepNumber: s.order
      }))
    } catch (error) {
      console.warn('⚠️ Failed to fetch steps from DB:', error)
      steps = []
    }
  }

  if (!steps.length) {
    return res.status(200).json({
      ok: true,
      source: 'FALLBACK_EMPTY',
      answer: 'No steps available for this training yet.'
    })
  }

  // 2) Intent router (cheap + deterministic)
  const q = question.trim().toLowerCase()

  // how many steps?
  if (/(how many|count).*(step|steps)/.test(q)) {
    return res.json({ ok:true, source:'RULES_COUNT', answer:`There are ${steps.length} steps.` })
  }

  // what step am I on?
  if (/what (step am i on|step number)/.test(q)) {
    const idx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps)
    if (idx != null) {
      return res.json({ ok:true, source:'RULES_CURRENT', answer:`You're on step ${idx+1}: ${steps[idx].text}` })
    }
  }

  // next / previous step
  if (/^next( step)?$/.test(q) || /go to next/.test(q)) {
    const idx = Math.min((currentStepIndex ?? inferIndexFromTimeOrCurrent(currentTime, undefined, steps) ?? -1)+1, steps.length-1)
    return res.json({ ok:true, source:'RULES_NEXT', answer:`Step ${idx+1}: ${steps[idx].text}` })
  }
  if (/^(prev|previous)( step)?$/.test(q)) {
    const idx = Math.max((currentStepIndex ?? inferIndexFromTimeOrCurrent(currentTime, undefined, steps) ?? 0)-1, 0)
    return res.json({ ok:true, source:'RULES_PREV', answer:`Step ${idx+1}: ${steps[idx].text}` })
  }

  // nth step ( "what is the 3rd step", "step 2 please" )
  const n = parseOrdinal(q)
  if (n != null && steps[n-1]) {
    return res.json({ ok:true, source:'RULES_ORDINAL', answer:`Step ${n}: ${steps[n-1].text}` })
  }

  // vague "how do i enter", "how do I plug it in" → map to current step + aliases/keywords
  if (/^how do i /.test(q) || /how .* (do|to)/.test(q)) {
    const idx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps) ?? 0
    const best = keywordMatch(q, steps, idx)
    if (best) {
      return res.json({ ok:true, source:'RULES_KEYWORD', answer:`Step ${best.index+1}: ${best.step.text}` })
    }
  }

  // 3) RAG + AI (for random, process-specific questions)
  try {
    // Get context using RAG
    const { pool, strong } = await RetrievalService.getContextForQuestion(moduleId, question, 6)
    
    if (strong.length > 0) {
      // We have good context - try AI with RAG
      const { system, user } = PromptService.buildEnhancedPrompt(
        question, 
        strong, 
        steps, 
        currentStepIndex, 
        currentTime
      )
      
      const aiResult = await aiService.generateContextualResponse(question, {
        currentStep: currentStepIndex != null ? steps[currentStepIndex] : undefined,
        allSteps: steps,
        videoTime: currentTime || 0,
        moduleId,
        userId: undefined,
      })

      if (aiResult.ok && !looksLikePlaceholder(aiResult.text)) {
        // AI worked with RAG context
        return res.json({ 
          ok: true, 
          source: 'RAG+AI', 
          answer: aiResult.text.trim(),
          cites: strong.slice(0, 3).map(c => ({ kind: c.kind, text: c.text, meta: c.meta }))
        })
      }
    }

    // RAG context was weak or AI failed - try basic AI
    const aiResult = await aiService.generateContextualResponse(question, {
      currentStep: currentStepIndex != null ? steps[currentStepIndex] : undefined,
      allSteps: steps,
      videoTime: currentTime || 0,
      moduleId,
      userId: undefined,
    })

    if (aiResult.ok && !looksLikePlaceholder(aiResult.text)) {
      // Basic AI worked
      return res.json({ ok: true, source: 'AI', answer: aiResult.text.trim() })
    }

    // AI failed or returned placeholder - fallback to keyword matching
    const best = keywordMatch(q, steps)
    if (best) {
      return res.json({ 
        ok: true, 
        source: 'FALLBACK_KEYWORD', 
        answer: `Step ${best.index + 1}: ${best.step.text}` 
      })
    }

    // Last resort - helpful suggestions
    const currentIdx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps) ?? 0
    return res.json({
      ok: true,
      source: 'FALLBACK_EMPTY',
      answer: `I couldn't find that in the module. Try asking about a step number (e.g., "What is step ${currentIdx + 1}?") or a specific action (e.g., "insert the card").`
    })

  } catch (error) {
    console.warn('⚠️ AI service failed, using fallback:', error)
    
    // fallback: best keyword match anywhere
    const best = keywordMatch(q, steps)
    if (best) {
      return res.json({ 
        ok: true, 
        source: 'FALLBACK_KEYWORD', 
        answer: `Step ${best.index + 1}: ${best.step.text}` 
      })
    }
    
    // last resort
    const currentIdx = inferIndexFromTimeOrCurrent(currentTime, currentStepIndex, steps) ?? 0
    return res.json({
      ok: true,
      source: 'FALLBACK_EMPTY',
      answer: `I can't tell from that—try "What is step ${currentIdx + 1}?" or "Next step".`
    })
  }
}

// ---------- helpers ----------
function parseOrdinal(q: string) {
  const m1 = q.match(/(?:^|\s)(\d+)(?:st|nd|rd|th)?\s*step/) // "3rd step"
  if (m1) return parseInt(m1[1], 10)
  const m2 = q.match(/step\s*(\d+)/) // "step 3"
  if (m2) return parseInt(m2[1], 10)
  return null
}

function inferIndexFromTimeOrCurrent(time?: number, cur?: number, steps?: any[]) {
  if (typeof cur === 'number') return cur
  if (typeof time === 'number' && steps?.length) {
    const i = steps.findIndex(s => typeof s.start==='number' && typeof s.end==='number' && time>=s.start && time<=s.end)
    return i >= 0 ? i : 0
  }
  return undefined
}

function keywordMatch(q: string, steps: Array<any>, seedIndex?: number) {
  const qn = q.toLowerCase()
  let best = { score: -1, index: 0, step: steps[0] }
  steps.forEach((s, i) => {
    const hay = [
      (s.text||'').toLowerCase(),
      ...(Array.isArray(s.aliases) ? s.aliases.map((a:string)=>a.toLowerCase()) : []),
    ].join(' ')
    const score = overlap(qn, hay) + (i===seedIndex ? 0.15 : 0) // slight bias to current step
    if (score > best.score) best = { score, index:i, step:s }
  })
  return best.score > 0 ? best : null
}

function overlap(a: string, b: string) {
  const A = new Set(a.split(/\W+/).filter(Boolean))
  const B = new Set(b.split(/\W+/).filter(Boolean))
  let hit = 0; A.forEach(w => { if (B.has(w)) hit++ })
  return hit / Math.max(A.size, 1)
}

function looksLikePlaceholder(text?: string) {
  if (!text) return true
  const t = text.trim().toLowerCase()
  if (t.length < 30 && (t.includes('sorry') || t.includes('unavailable'))) return true
  if (t.includes('enhanced ai contextual response service is not currently available')) return true
  return false
}

/**
 * Main QA endpoint for random, process-specific questions using RAG
 */
export async function qaAsk(req: Request, res: Response) {
  const { moduleId, question, currentStepIndex, videoTime } = req.body as {
    moduleId: string; question: string; currentStepIndex?: number; videoTime?: number;
  }
  if (!moduleId || !question) return res.status(400).json({ ok:false, error:'moduleId and question required' })

  const steps = await aiService.getSteps(moduleId)
  if (!steps?.length) return res.json({ ok:true, source:'EMPTY', answer:'No steps available yet for this module.' })

  const q = question.trim()

  // 1) Deterministic intents
  const n = parseOrdinal(q)
  if (n && steps[n-1]) {
    return res.json({ ok:true, source:'RULES_ORDINAL', answer:`Step ${n}: ${steps[n-1].text}` })
  }
  if (/how many.*step/.test(q.toLowerCase())) {
    return res.json({ ok:true, source:'RULES_COUNT', answer:`There are ${steps.length} steps.` })
  }
  if (/what step am i on|step number/i.test(q)) {
    const idx = typeof currentStepIndex === 'number' ? currentStepIndex : 0
    return res.json({ ok:true, source:'RULES_CURRENT', answer:`You're on step ${idx+1}: ${steps[idx].text}` })
  }

  // 2) RAG retrieval (Q&A + transcript)
  try {
    const { strong } = await RetrievalService.getContextForQuestion(moduleId, q)
    if (strong.length) {
      const { system, user } = buildRagPrompt(q, steps.length, strong.map(s => ({ kind: s.kind, text: s.text })))
      const ai = await askAI({ system, prompt: user })
      if (ai.ok && !looksLikePlaceholder(ai.text)) {
        // Log successful Q&A for future recall
        try {
          await logQA({
            moduleId,
            question: q,
            answer: ai.text,
            videoTime
          })
        } catch (error) {
          console.warn('⚠️ Failed to log Q&A:', error)
        }
        
        return res.json({ ok:true, source:'RAG+AI', answer: ai.text, cites: strong.slice(0,3) })
      }
    }
  } catch (error) {
    console.warn('⚠️ RAG retrieval failed:', error)
  }

  // 3) Fallback to best step (keyword/alias)
  const k = keywordMatch(q, steps)
  if (k && k.score > 0) {
    return res.json({ ok:true, source:'FALLBACK_KEYWORD', answer:`Step ${k.index+1}: ${k.step.text}` })
  }

  // 4) Last resort
  return res.json({
    ok:true,
    source:'FALLBACK_EMPTY',
    answer:`I couldn't find that in the module. Try asking about a step number (e.g., "What is step 3?") or a specific action.`
  })
} 