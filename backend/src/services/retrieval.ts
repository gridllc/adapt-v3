import { prisma } from '../config/database.js'
import { embed } from './embeddings.js'

export type Retrieved = {
  kind: 'qa' | 'step'
  id: string
  text: string
  score: number
  meta: any
}

export async function retrieveForQuestion(moduleId: string, question: string, k = 6) {
  try {
    const qvec = await embed(question)

    // Search through existing questions (if any)
    const questions = await prisma.question.findMany({
      where: { moduleId },
      select: { id: true, question: true, answer: true, stepId: true, videoTime: true }
    })

    // Search through steps for semantic similarity
    const steps = await prisma.step.findMany({
      where: { moduleId },
      select: { id: true, text: true, order: true }
    })

    // Simple keyword matching for now (can be enhanced with embeddings later)
    const q = question.toLowerCase()
    const qa = questions
      .map(qa => ({
        kind: 'qa' as const,
        id: qa.id,
        text: qa.answer,
        score: calculateKeywordScore(q, qa.question + ' ' + qa.answer),
        meta: { question: qa.question, stepId: qa.stepId, videoTime: qa.videoTime }
      }))
      .filter(item => item.score > 0.1)

    const stepResults = steps
      .map(step => ({
        kind: 'step' as const,
        id: step.id,
        text: step.text,
        score: calculateKeywordScore(q, step.text),
        meta: { order: step.order }
      }))
      .filter(item => item.score > 0.1)

    const pool = [...qa, ...stepResults].sort((a, b) => b.score - a.score).slice(0, k)
    const strong = pool.filter(p => p.score >= 0.2) // tune threshold
    
    return { pool, strong }
  } catch (error) {
    console.error('❌ Retrieval failed:', error)
    return { pool: [], strong: [] }
  }
}

function calculateKeywordScore(query: string, text: string): number {
  const queryWords = new Set(query.split(/\W+/).filter(w => w.length > 2))
  const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2)
  
  let hits = 0
  for (const word of queryWords) {
    if (textWords.some(tw => tw.includes(word) || word.includes(tw))) {
      hits++
    }
  }
  
  return hits / Math.max(1, queryWords.size)
}
