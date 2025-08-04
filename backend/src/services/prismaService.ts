import { PrismaClient } from '@prisma/client'
import { calculateCosineSimilarity } from '../utils/vectorUtils.js'

// Global prisma instance to prevent multiple connections
declare global {
  var __prisma: PrismaClient | undefined
}

const prisma = globalThis.__prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export { prisma }

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

  static async getAllModules(userId?: string) {
    return await prisma.module.findMany({
      where: userId ? { userId } : undefined,
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
    context?: any
  }) {
    return await prisma.aIInteraction.create({
      data
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
    return await prisma.trainingSession.updateMany({
      where: { sessionId },
      data: { 
        endedAt: new Date(),
        duration: {
          // Calculate duration in seconds
          // This is a simplified version - you might want to calculate this properly
        }
      }
    })
  }

  // Activity Log operations
  static async createActivityLog(data: {
    userId?: string
    action: string
    targetId?: string
    metadata?: any
  }) {
    return await prisma.activityLog.create({
      data
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
      .map((vector: any) => ({
        ...vector,
        similarity: calculateCosineSimilarity(embedding, vector.embedding)
      }))
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
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }
} 