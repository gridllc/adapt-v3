import { prisma } from '../config/database.js'
import { embed } from './embeddings.js'

export type Retrieved = {
  kind: 'qa' | 'segment' | 'step'
  id: string
  text: string
  score: number
  meta: any
}

export class RetrievalService {
  /**
   * Get context for a question using vector similarity search
   * Falls back to keyword matching if vectors aren't available
   */
  static async getContextForQuestion(moduleId: string, question: string, k = 6) {
    try {
      // Try vector search first
      const qVec = await embed(question)
      
      // Search across different content types
      const [qa, segments, steps] = await Promise.all([
        this.searchQAVectors(moduleId, qVec, Math.floor(k / 3)),
        this.searchTranscriptVectors(moduleId, qVec, Math.floor(k / 3)),
        this.searchStepVectors(moduleId, qVec, Math.floor(k / 3))
      ])

      const pool = [...qa, ...segments, ...steps].sort((a, b) => b.score - a.score).slice(0, k)
      const strong = pool.filter(x => x.score >= 0.25) // tune threshold
      
      return { pool, strong }
    } catch (error) {
      console.warn('⚠️ Vector search failed, falling back to keyword matching:', error)
      // Fallback to keyword matching
      return this.fallbackKeywordSearch(moduleId, question, k)
    }
  }

  /**
   * Search Q&A vectors using pgvector
   */
  private static async searchQAVectors(moduleId: string, queryVector: number[], k: number): Promise<Retrieved[]> {
    try {
      // Check if Question table has embeddings via QuestionVector
      const qaResults = await prisma.$queryRaw<Retrieved[]>`
        SELECT 
          'qa' as kind, 
          q.id::text, 
          q.answer as text,
          json_build_object('question', q.question, 'stepId', q.stepId, 'videoTime', q.videoTime) as meta,
          1 - (qv.embedding <=> ${queryVector}::vector) as score
        FROM "Question" q
        JOIN "QuestionVector" qv ON q.id = qv."questionId"
        WHERE q."moduleId" = ${moduleId} AND qv.embedding IS NOT NULL
        ORDER BY qv.embedding <=> ${queryVector}::vector ASC 
        LIMIT ${k}
      `
      
      return qaResults
    } catch (error) {
      console.warn('⚠️ Q&A vector search failed:', error)
      return []
    }
  }

  /**
   * Search transcript vectors using pgvector
   */
  private static async searchTranscriptVectors(moduleId: string, queryVector: number[], k: number): Promise<Retrieved[]> {
    try {
      // Check if vector table exists
      const tableExists = await prisma.$queryRaw<[{ exists: boolean }]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'TranscriptVector'
        ) as exists
      `
      
      if (!tableExists[0]?.exists) {
        return []
      }

      // Use vector similarity search
      const results = await prisma.$queryRaw<Retrieved[]>`
        SELECT 
          'segment' as kind, 
          id::text, 
          text, 
          json_build_object('start', start, 'end', "end") as meta,
          1 - (embedding <=> ${queryVector}::vector) as score
        FROM "TranscriptVector" 
        WHERE "moduleId" = ${moduleId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${queryVector}::vector ASC 
        LIMIT ${k}
      `
      
      return results
    } catch (error) {
      console.warn('⚠️ Transcript vector search failed:', error)
      return []
    }
  }

  /**
   * Search step vectors using pgvector
   */
  private static async searchStepVectors(moduleId: string, queryVector: number[], k: number): Promise<Retrieved[]> {
    try {
      // Check if vector table exists
      const tableExists = await prisma.$queryRaw<[{ exists: boolean }]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'StepVector'
        ) as exists
      `
      
      if (!tableExists[0]?.exists) {
        // Fallback to keyword search on steps
        return this.searchStepsByKeyword(moduleId, queryVector, k)
      }

      // Use vector similarity search
      const results = await prisma.$queryRaw<Retrieved[]>`
        SELECT 
          'step' as kind, 
          id::text, 
          text, 
          json_build_object('index', "index", 'start', start, 'end', "end") as meta,
          1 - (embedding <=> ${queryVector}::vector) as score
        FROM "StepVector" 
        WHERE "moduleId" = ${moduleId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${queryVector}::vector ASC 
        LIMIT ${k}
      `
      
      return results
    } catch (error) {
      console.warn('⚠️ Step vector search failed:', error)
      return this.searchStepsByKeyword(moduleId, queryVector, k)
    }
  }

  /**
   * Fallback keyword search on steps when vectors aren't available
   */
  private static async searchStepsByKeyword(moduleId: string, queryVector: number[], k: number): Promise<Retrieved[]> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, startTime: true, endTime: true, order: true }
      })

      // Simple keyword matching as fallback
      const query = queryVector.join(' ') // This is a hack - in real implementation you'd use the actual question text
      const scored = steps.map(step => {
        const text = step.text.toLowerCase()
        const score = this.simpleKeywordScore(query.toLowerCase(), text)
        return {
          kind: 'step' as const,
          id: step.id,
          text: step.text || `Step ${step.order}`,
          meta: { index: step.order, start: step.startTime, end: step.endTime },
          score
        }
      })

      return scored
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
    } catch (error) {
      console.warn('⚠️ Step keyword search failed:', error)
      return []
    }
  }

  /**
   * Fallback keyword search when vectors fail
   */
  private static async fallbackKeywordSearch(moduleId: string, question: string, k: number): Promise<{ pool: Retrieved[], strong: Retrieved[] }> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, startTime: true, endTime: true, order: true }
      })

      const scored = steps.map(step => {
        const text = step.text.toLowerCase()
        const score = this.simpleKeywordScore(question.toLowerCase(), text)
        return {
          kind: 'step' as const,
          id: step.id,
          text: step.text || `Step ${step.order}`,
          meta: { index: step.order, start: step.startTime, end: step.endTime },
          score
        }
      })

      const pool = scored
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k)

      const strong = pool.filter(x => x.score >= 0.1) // Lower threshold for keyword fallback
      
      return { pool, strong }
    } catch (error) {
      console.warn('⚠️ Fallback keyword search failed:', error)
      return { pool: [], strong: [] }
    }
  }

  /**
   * Simple keyword overlap scoring
   */
  private static simpleKeywordScore(query: string, text: string): number {
    const queryWords = new Set(query.split(/\W+/).filter(Boolean))
    const textWords = new Set(text.split(/\W+/).filter(Boolean))
    
    let hits = 0
    queryWords.forEach(word => {
      if (textWords.has(word)) hits++
    })
    
    return hits / Math.max(queryWords.size, 1)
  }
}
