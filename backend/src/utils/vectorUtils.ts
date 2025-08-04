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

    return response.data[0].embedding
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

  let bestMatch = null
  let highestSimilarity = 0

  for (const existing of existingQuestions) {
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
    
    const savedQuestion = await DatabaseService.createQuestion({
      moduleId: data.moduleId,
      stepId: data.stepId,
      question: data.question,
      answer: data.answer,
      videoTime: data.videoTime,
      userId: data.userId
    })

    // Save embedding
    await DatabaseService.createQuestionVector({
      questionId: savedQuestion.id,
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
 * Find similar interactions using vector search
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
    
    // Use DatabaseService to find similar questions
    const { DatabaseService } = await import('../services/prismaService.js')
    const similarQuestions = await DatabaseService.findSimilarQuestions(moduleId, queryEmbedding, similarityThreshold)
    
    // Return top K results
    return similarQuestions.slice(0, topK).map((q: any) => ({
      question: q.question.question,
      answer: q.question.answer,
      similarity: q.similarity,
      stepId: q.question.stepId,
      videoTime: q.question.videoTime,
      createdAt: q.question.createdAt
    }))
  } catch (error) {
    console.error('❌ Failed to find similar interactions:', error)
    return []
  }
} 