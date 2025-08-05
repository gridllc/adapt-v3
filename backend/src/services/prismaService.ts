import { PrismaClient } from '@prisma/client'
import { calculateCosineSimilarity } from '../utils/vectorUtils.js'

// Type definitions for better type safety
interface VectorWithEmbedding {
  embedding: number[]
  question: {
    step?: { title: string; timestamp: number }
  }
}

// Create Prisma client instance
const prisma = new PrismaClient()

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
    userId?: string
  }) {
    return await prisma.module.create({
      data: {
        id: data.id,
        title: data.title,
        filename: data.filename,
        videoUrl: data.videoUrl,
        userId: data.userId
      }
    })
  }

  static async getModule(id: string) {
    return await prisma.module.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        },
        statuses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })
  }

  static async getAllModules(filters?: { ownerId?: string; status?: string; userId?: string }) {
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
    // Create new status record
    await prisma.moduleStatus.create({
      data: {
        moduleId: id,
        status,
        progress,
        message
      }
    })

    // Update module status
    return await prisma.module.update({
      where: { id },
      data: { status, progress }
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
    timestamp: number
    title: string
    description: string
    duration: number
  }>) {
    const stepData = steps.map((step, index) => ({
      moduleId,
      timestamp: step.timestamp,
      title: step.title,
      description: step.description,
      duration: step.duration,
      order: index + 1
    }))

    return await prisma.step.createMany({
      data: stepData
    })
  }

  static async getSteps(moduleId: string) {
    return await prisma.step.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' }
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

  // AI Interaction operations
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
          select: { title: true, timestamp: true }
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
          select: { title: true, timestamp: true }
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
    return await prisma.questionVector.create({
      data
    })
  }

  static async findSimilarQuestions(moduleId: string, embedding: number[], threshold: number = 0.8) {
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
              select: { title: true, timestamp: true }
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

    return similarQuestions.slice(0, 3) // Return top 3 matches
  }

  static async getQuestionHistory(moduleId: string, limit: number = 10) {
    return await prisma.question.findMany({
      where: { moduleId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        step: {
          select: { title: true, timestamp: true }
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
      await prisma.module.findFirst({ select: { id: true } })
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }
} 