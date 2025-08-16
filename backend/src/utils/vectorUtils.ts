import OpenAI from 'openai'

// Initialize OpenAI for embeddings
let openai: OpenAI | undefined
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
} catch (error) {
  console.error('Failed to initialize OpenAI for embeddings:', error)
}

/**
 * Calculate cosine similarity between two vectors
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!openai) {
    throw new Error('OpenAI not initialized')
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })

    const embedding = response.data[0].embedding
    
    // Validate embedding dimensions
    if (embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding.length}`)
    }

    return embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

/**
 * Find the most similar question from a list
 */
export function findMostSimilarQuestion(
  newEmbedding: number[],
  existingQuestions: Array<{ embedding: number[]; question: string; answer: string }>
): { question: string; answer: string; similarity: number } | null {
  if (existingQuestions.length === 0) {
    return null
  }

  // Validate embedding dimensions
  if (newEmbedding.length !== 1536) {
    throw new Error(`Invalid embedding dimensions: expected 1536, got ${newEmbedding.length}`)
  }

  let bestMatch = null
  let highestSimilarity = 0

  for (const existing of existingQuestions) {
    if (existing.embedding.length !== 1536) {
      console.warn(`Skipping question with invalid embedding dimensions: ${existing.embedding.length}`)
      continue
    }
    
    const similarity = calculateCosineSimilarity(newEmbedding, existing.embedding)
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity
      bestMatch = {
        question: existing.question,
        answer: existing.answer,
        similarity
      }
    }
  }

  return bestMatch
}

/**
 * Log interaction to vector database with embedding
 */
export async function logInteractionToVectorDB(data: {
  question: string
  answer: string
  moduleId: string
  stepId?: string
  videoTime?: number
  userId?: string
}) {
  try {
    // Generate embedding for the question
    const embedding = await generateEmbedding(data.question)
    
    // Save to database using DatabaseService
    const { DatabaseService } = await import('../services/prismaService.js')
    
    // Use the new bundled method for better consistency
    const savedQuestion = await DatabaseService.createQuestionWithVector({
      moduleId: data.moduleId,
      stepId: data.stepId,
      question: data.question,
      answer: data.answer,
      videoTime: data.videoTime,
      userId: data.userId,
      embedding
    })

    console.log('✅ Interaction logged to vector database')
    return savedQuestion
  } catch (error) {
    console.error('❌ Failed to log interaction to vector database:', error)
    throw error
  }
}

/**
 * Find similar interactions using improved vector search
 * Supports global + module-specific search
 */
export async function findSimilarInteractions(
  query: string,
  moduleId: string,
  similarityThreshold = 0.85,
  topK = 5
) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)
    
    // Use DatabaseService to find similar questions with global fallback
    const { DatabaseService } = await import('../services/prismaService.js')
    
    // Search in module-specific questions first, then global
    const moduleIds = [moduleId]
    if (moduleId !== 'global') {
      moduleIds.push('global') // Add global as fallback
    }
    
    const similarQuestions = await DatabaseService.findSimilarQuestionsScoped(
      queryEmbedding, 
      moduleIds, 
      similarityThreshold, 
      topK
    )
    
    // Return top K results with enhanced metadata
    return similarQuestions.slice(0, topK).map((q: any) => ({
      question: q.question.question,
      answer: q.question.answer,
      similarity: q.similarity,
      stepId: q.question.stepId,
      videoTime: q.question.videoTime,
      createdAt: q.question.createdAt,
      questionId: q.question.id
    }))
  } catch (error) {
    console.error('❌ Failed to find similar interactions:', error)
    return []
  }
}

/**
 * Track when an answer is reused (simplified version)
 */
export async function trackAnswerReuse(questionId: string) {
  try {
    console.log(`✅ Tracked reuse for question ${questionId}`)
    // Note: Full reuse tracking requires the reuseCount field in the schema
    // This is a placeholder for when the schema is updated
  } catch (error) {
    console.error('❌ Failed to track answer reuse:', error)
  }
} 
