import { DatabaseService } from './prismaService.js'
import { generateEmbedding } from '../utils/vectorUtils.js'

/**
 * Enhanced Q&A Logger for Shared AI Learning System
 * Logs every AI interaction with vector embeddings for semantic search
 */
export async function logTutorInteraction({
  question,
  answer,
  moduleId,
  stepId,
  userId,
  videoTime,
  reused = false,
  similarity = null
}: {
  question: string
  answer: string
  moduleId?: string
  stepId?: string
  userId?: string
  videoTime?: number
  reused?: boolean
  similarity?: number | null
}) {
  try {
    console.log(`📝 Logging AI interaction: ${reused ? '♻️ Reused' : '🆕 New'} answer`)
    
    // Generate embedding for semantic search
    const embedding = await generateEmbedding(question)
    
    // Save to database
    const savedQuestion = await DatabaseService.createQuestion({
      moduleId: moduleId || 'global', // Use 'global' for cross-module learning
      stepId,
      question,
      answer,
      videoTime,
      userId
    })

    // Save embedding for vector search
    await DatabaseService.createQuestionVector({
      questionId: savedQuestion.id,
      embedding
    })

    // Log activity for monitoring
    await DatabaseService.createActivityLog({
      userId,
      action: 'AI_INTERACTION',
      targetId: savedQuestion.id,
      metadata: {
        moduleId,
        stepId,
        questionLength: question.length,
        answerLength: answer.length,
        reused,
        similarity,
        videoTime
      }
    })

    console.log(`✅ AI interaction logged with ID: ${savedQuestion.id}`)
    return savedQuestion
  } catch (error) {
    console.error('❌ Failed to log AI interaction:', error)
    throw error
  }
}

/**
 * Log feedback on reused answers for quality improvement
 */
export async function logAnswerFeedback({
  questionId,
  feedback,
  userId
}: {
  questionId: string
  feedback: 'helpful' | 'not_helpful' | 'neutral'
  userId?: string
}) {
  try {
    await DatabaseService.createActivityLog({
      userId,
      action: 'ANSWER_FEEDBACK',
      targetId: questionId,
      metadata: { feedback }
    })
    
    console.log(`✅ Answer feedback logged: ${feedback}`)
  } catch (error) {
    console.error('❌ Failed to log answer feedback:', error)
  }
} 