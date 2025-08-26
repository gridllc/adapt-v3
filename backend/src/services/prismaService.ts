import { prisma } from '../config/database.js'
import { ModuleStatus } from '@prisma/client'
import { calculateCosineSimilarity } from '../utils/vectorUtils.js'

// Type definitions for better type safety
interface VectorWithEmbedding {
  embedding: number[]
  question: {
    step?: { title: string; startTime: number }
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export default prisma

// Database service functions
export class DatabaseService {
  // User operations
  static async createUser(data: {
    email: string
    clerkId?: string
  }) {
    return await prisma.user.create({
      data
    })
  }

  static async getUserByClerkId(clerkId: string) {
    return await prisma.user.findUnique({
      where: { clerkId }
    })
  }

  static async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    })
  }

  static async getUserCount() {
    return await prisma.user.count()
  }

  // Module operations
  static async createModule(data: {
    id: string
    title: string
    filename: string
    videoUrl: string
    status?: string
    progress?: number
    userId?: string
    s3Key?: string
    stepsKey?: string
  }) {
    try {
      const module = await prisma.module.create({
        data: {
          id: data.id,
          title: data.title,
          filename: data.filename,
          videoUrl: data.videoUrl,
          status: (data.status as any) || 'UPLOADED',
          progress: data.progress || 0,
          userId: data.userId || null,
          s3Key: data.s3Key || null,
          stepsKey: data.stepsKey || null,
        }
      })
      return module
    } catch (error) {
      console.error('❌ Failed to create module:', error)
      throw error
    }
  }

  static async getModule(id: string) {
    return await prisma.module.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    })
  }

  static async getModuleCountByUser(userId: string) {
    return await prisma.module.count({
      where: { userId }
    })
  }

  static async getAllModules(filters?: { ownerId?: string; status?: ModuleStatus; userId?: string }) {
    const where: any = {}
    
    if (filters?.userId) {
      where.userId = filters.userId
    }
    
    if (filters?.ownerId) {
      where.userId = filters.ownerId
    }
    
    if (filters?.status) {
      where.status = filters.status
    }
    
    return await prisma.module.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { steps: true }
        }
      }
    })
  }

  static async updateModuleStatus(id: string, status: string, progress: number, message?: string) {
    // Update module status directly (no more moduleStatus table)
    return await prisma.module.update({
      where: { id },
      data: { status: status as any, progress }
    })
  }

  static async deleteModule(id: string) {
    return await prisma.module.delete({
      where: { id }
    })
  }

  static async updateModule(id: string, data: Record<string, unknown>) {
    return await prisma.module.update({
      where: { id },
      data
    })
  }

  // Step operations
  static async createSteps(moduleId: string, steps: Array<{
    text?: string
    title?: string
    description?: string
    startTime?: number
    endTime?: number
    timestamp?: number
    duration?: number
  }>) {
    const stepData = steps.map((step, index) => ({
      moduleId,
      text: step.text || step.title || step.description || '',
      startTime: step.startTime || step.timestamp || 0,
      endTime: step.endTime || (step.startTime || step.timestamp || 0) + (step.duration || 15),
      order: index + 1
    }))

    return await prisma.step.createMany({
      data: stepData
    })
  }

  static async getSteps(moduleId: string) {
    return await prisma.step.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            answer: true,
            videoTime: true,
            isFAQ: true,
            createdAt: true
          }
        }
      }
    })
  }

  // Feedback operations
  static async createFeedback(data: {
    moduleId: string
    type: string
    action: string
    context?: string
    sessionId?: string
  }) {
    return await prisma.feedback.create({
      data
    })
  }

  static async getFeedbackStats() {
    const [total, positive, negative] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { action: 'worked' } }),
      prisma.feedback.count({ where: { action: 'not_working' } })
    ])

    return { total, positive, negative }
  }

  /**
   * Create AI interaction with enhanced tracking
   */
  static async createAIInteraction(data: {
    moduleId: string
    userMessage: string
    aiResponse: string
    source?: string
    context?: Record<string, unknown>
  }) {
    return await prisma.aIInteraction.create({
      data: {
        moduleId: data.moduleId,
        userMessage: data.userMessage,
        aiResponse: data.aiResponse,
        source: data.source,
        context: data.context ? JSON.parse(JSON.stringify(data.context)) : undefined
      }
    })
  }

  // Training Session operations
  static async createTrainingSession(data: {
    moduleId: string
    sessionId: string
    userId?: string
  }) {
    return await prisma.trainingSession.create({
      data
    })
  }

  static async endTrainingSession(sessionId: string) {
    // First get the training session to calculate duration
    const training = await prisma.trainingSession.findFirst({
      where: { sessionId }
    })
    
    if (!training) {
      throw new Error('Training session not found')
    }
    
    const endedAt = new Date()
    const duration = training.startedAt 
      ? Math.floor((endedAt.getTime() - training.startedAt.getTime()) / 1000)
      : 0
    
    return await prisma.trainingSession.updateMany({
      where: { sessionId },
      data: { 
        endedAt,
        duration
      }
    })
  }

  // Activity Log operations
  static async createActivityLog(data: {
    userId?: string
    action: string
    targetId?: string
    metadata?: Record<string, unknown>
  }) {
    return await prisma.activityLog.create({
      data: {
        ...(data.userId ? { userId: data.userId } : {}),
        action: data.action,
        targetId: data.targetId,
        metadata: data.metadata as any
      }
    })
  }

  static async getActivityLogs(userId?: string, limit: number = 100) {
    return await prisma.activityLog.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true }
        }
      }
    })
  }

  // Question operations
  static async createQuestion(data: {
    moduleId: string
    stepId?: string
    question: string
    answer: string
    videoTime?: number
    userId?: string
  }) {
    return await prisma.question.create({
      data
    })
  }

  static async getQuestions(moduleId: string, includeFAQ: boolean = false) {
    return await prisma.question.findMany({
      where: {
        moduleId,
        ...(includeFAQ ? {} : { isFAQ: false })
      },
      orderBy: { createdAt: 'desc' },
      include: {
        step: {
          select: { text: true, startTime: true }
        },
        user: {
          select: { email: true }
        }
      }
    })
  }

  static async getFAQ(moduleId: string) {
    return await prisma.question.findMany({
      where: {
        moduleId,
        isFAQ: true
      },
      orderBy: { createdAt: 'desc' },
      include: {
        step: {
          select: { text: true, startTime: true }
        }
      }
    })
  }

  static async toggleFAQ(questionId: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId }
    })
    
    if (!question) {
      throw new Error('Question not found')
    }
    
    return await prisma.question.update({
      where: { id: questionId },
      data: { isFAQ: !question.isFAQ }
    })
  }

  // Vector search operations
  static async createQuestionVector(data: {
    questionId: string
    embedding: number[]
  }) {
    // Validate vector dimensions
    if (data.embedding.length !== 1536) {
      throw new Error(`Invalid vector size — must be 1536 dimensions, got ${data.embedding.length}`)
    }

    return await prisma.questionVector.create({
      data: {
        questionId: data.questionId,
        embedding: data.embedding
      }
    })
  }

  /**
   * Find similar questions using native pgvector ANN search
   * Supports searching across multiple modules (primary + global fallback)
   */
  static async findSimilarQuestionsScoped(
    embedding: number[],
    moduleIds: string[], // primary + global modules
    threshold: number = 0.8,
    limit: number = 5
  ) {
    // Validate vector dimensions
    if (embedding.length !== 1536) {
      throw new Error(`Invalid vector size — must be 1536 dimensions, got ${embedding.length}`)
    }

    try {
      // Use native pgvector ANN search for better performance
      const results = await prisma.$queryRawUnsafe(`
        SELECT 
          q.*,
          qv.embedding,
          1 - (qv.embedding <=> $1) AS similarity
        FROM question_vectors qv
        JOIN questions q ON q.id = qv.question_id
        WHERE q.module_id = ANY($2)
        ORDER BY qv.embedding <=> $1
        LIMIT $3
      `, embedding, moduleIds, limit)

      // Filter by threshold and return
      return (results as any[])
        .filter((item: any) => item.similarity >= threshold)
        .map((item: any) => ({
          ...item,
          question: {
            id: item.id,
            moduleId: item.module_id,
            stepId: item.step_id,
            question: item.question,
            answer: item.answer,
            videoTime: item.video_time,
            isFAQ: item.is_faq,
            userId: item.user_id,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          }
        }))
    } catch (error) {
      console.error('Native pgvector search failed, falling back to JS calculation:', error)
      
      // Fallback to JS calculation if native search fails
      return await this.findSimilarQuestionsJS(embedding, moduleIds[0], threshold, limit)
    }
  }

  /**
   * Fallback method using JavaScript cosine similarity
   * Used when native pgvector search is not available
   */
  static async findSimilarQuestionsJS(
    embedding: number[],
    moduleId: string,
    threshold: number = 0.8,
    limit: number = 5
  ) {
    const vectors = await prisma.questionVector.findMany({
      where: {
        question: {
          moduleId
        }
      },
      include: {
        question: {
          include: {
            step: {
              select: { text: true, startTime: true }
            }
          }
        }
      }
    })

    // Calculate cosine similarity and filter by threshold
    const similarQuestions = vectors
      .map((vector: any) => {
        const sim = calculateCosineSimilarity(embedding, vector.embedding)
        return { ...vector, similarity: sim }
      })
      .filter((item: any) => item.similarity >= threshold)
      .sort((a: any, b: any) => b.similarity - a.similarity)

    return similarQuestions.slice(0, limit)
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use findSimilarQuestionsScoped instead
   */
  static async findSimilarQuestions(moduleId: string, embedding: number[], threshold: number = 0.8) {
    return await this.findSimilarQuestionsScoped(embedding, [moduleId], threshold, 3)
  }

  /**
   * Enhanced createQuestion method that bundles vector creation
   */
  static async createQuestionWithVector(data: {
    moduleId: string
    stepId?: string
    question: string
    answer: string
    videoTime?: number
    userId?: string
    embedding: number[]
  }) {
    // Create the question first
    const question = await this.createQuestion({
      moduleId: data.moduleId,
      stepId: data.stepId,
      question: data.question,
      answer: data.answer,
      videoTime: data.videoTime,
      userId: data.userId
    })

    // Create the vector embedding
    await this.createQuestionVector({
      questionId: question.id,
      embedding: data.embedding
    })

    return question
  }

  /**
   * Get step confusion analytics
   */
  static async getStepConfusionAnalytics(moduleId: string) {
    return await prisma.step.findMany({
      where: { moduleId },
      include: {
        questions: {
          select: {
            id: true,
            question: true
          }
        }
      },
      orderBy: { order: 'asc' }
    })
  }



  static async getQuestionHistory(moduleId: string, limit: number = 10) {
    return await prisma.question.findMany({
      where: { moduleId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        step: {
          select: { text: true, startTime: true }
        },
        user: {
          select: { email: true }
        }
      }
    })
  }

  // Health check
  static async healthCheck() {
    try {
      // Test both connection and table access
      // Simple health check - just try to find any module
      await prisma.module.findFirst({ 
        select: { id: true } 
      })
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }
} 