import { DatabaseService } from './prismaService.js'
import { generateEmbedding } from '../utils/vectorUtils.js'

/**
 * Enhanced Semantic Search for Shared AI Learning System
 * Finds similar questions across all modules for shared learning
 */
export async function findSimilarInteractions({
  question,
  moduleId,
  stepId,
  includeGlobal = true, // Include cross-module learning
  similarityThreshold = 0.85,
  maxResults = 5
}: {
  question: string
  moduleId?: string
  stepId?: string
  includeGlobal?: boolean
  similarityThreshold?: number
  maxResults?: number
}) {
  try {
    console.log(`🔍 Searching for similar interactions: "${question.substring(0, 50)}..."`)
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(question)
    
    // Search within module first (more relevant)
    let moduleResults: any[] = []
    if (moduleId) {
      moduleResults = await DatabaseService.findSimilarQuestions(moduleId, queryEmbedding, similarityThreshold)
      console.log(`📊 Found ${moduleResults.length} similar questions in module ${moduleId}`)
    }
    
    // Search global knowledge base (cross-module learning)
    let globalResults: any[] = []
    if (includeGlobal) {
      globalResults = await DatabaseService.findSimilarQuestions('global', queryEmbedding, similarityThreshold)
      console.log(`🌍 Found ${globalResults.length} similar questions in global knowledge base`)
    }
    
    // Combine and deduplicate results
    const allResults = [...moduleResults, ...globalResults]
    const uniqueResults = deduplicateResults(allResults)
    
    // Sort by similarity and take top results
    const sortedResults = uniqueResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
    
    console.log(`✅ Found ${sortedResults.length} relevant similar interactions`)
    
    return sortedResults.map((result: any) => ({
      id: result.question.id,
      question: result.question.question,
      answer: result.question.answer,
      similarity: result.similarity,
      moduleId: result.question.moduleId,
      stepId: result.question.stepId,
      videoTime: result.question.videoTime,
      createdAt: result.question.createdAt,
      reused: false // Will be set to true if used
    }))
  } catch (error) {
    console.error('❌ Failed to find similar interactions:', error)
    return []
  }
}

/**
 * Find the best matching answer for reuse
 */
export async function findBestMatchingAnswer(
  question: string,
  moduleId?: string,
  similarityThreshold = 0.85
): Promise<{
  answer: string
  similarity: number
  questionId: string
  reused: boolean
  embedding?: number[]
  reason: 'matched-module-question' | 'matched-global-answer' | 'fresh-response'
} | null> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(question)
    
    const similarInteractions = await findSimilarInteractions({
      question,
      moduleId,
      similarityThreshold,
      maxResults: 1
    })
    
    if (similarInteractions.length > 0 && similarInteractions[0].similarity >= similarityThreshold) {
      const bestMatch = similarInteractions[0]
      const reason = bestMatch.moduleId === moduleId ? 'matched-module-question' : 'matched-global-answer'
      
      console.log(`[AI-REUSE] Using answer from ${bestMatch.moduleId || 'global'} | similarity: ${(bestMatch.similarity * 100).toFixed(1)}% | reason: ${reason}`)
      
      return {
        answer: bestMatch.answer,
        similarity: bestMatch.similarity,
        questionId: bestMatch.id,
        reused: true,
        embedding: queryEmbedding,
        reason
      }
    }
    
    console.log(`[AI-FALLBACK] No reuse match. Prompting GPT. Module: ${moduleId || 'none'}`)
    return null
  } catch (error) {
    console.error('❌ Error finding best matching answer:', error)
    return null
  }
}

/**
 * Get learning statistics for monitoring
 */
export async function getLearningStats() {
  try {
    const stats = await DatabaseService.getActivityLogs(undefined, 1000)
    
    const aiInteractions = stats.filter((log: any) => log.action === 'AI_INTERACTION')
    const reusedCount = aiInteractions.filter((log: any) => {
      const metadata = log.metadata as any
      return metadata?.reused === true
    }).length
    const totalInteractions = aiInteractions.length
    
    const reuseRate = totalInteractions > 0 ? (reusedCount / totalInteractions) * 100 : 0
    
    return {
      totalInteractions,
      reusedCount,
      reuseRate: Math.round(reuseRate * 100) / 100,
      averageSimilarity: calculateAverageSimilarity(aiInteractions),
      recentActivity: aiInteractions.slice(0, 10)
    }
  } catch (error) {
    console.error('❌ Failed to get learning stats:', error)
    return {
      totalInteractions: 0,
      reusedCount: 0,
      reuseRate: 0,
      averageSimilarity: 0,
      recentActivity: []
    }
  }
}

/**
 * Enhanced deduplication logic for search results
 */
function deduplicateResults(results: any[]): any[] {
  const seen = new Set<string>()
  return results.filter(result => {
    // Create a more robust key that includes both question and answer
    const key = JSON.stringify({
      q: result.question.question.toLowerCase().trim(),
      a: result.question.answer.toLowerCase().trim(),
    })
    
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Calculate average similarity from activity logs
 */
function calculateAverageSimilarity(interactions: any[]): number {
  const similarities = interactions
    .map(log => {
      const metadata = log.metadata as any
      return metadata?.similarity
    })
    .filter(sim => typeof sim === 'number')
  
  if (similarities.length === 0) return 0
  
  const sum = similarities.reduce((acc, sim) => acc + sim, 0)
  return Math.round((sum / similarities.length) * 1000) / 1000
} 