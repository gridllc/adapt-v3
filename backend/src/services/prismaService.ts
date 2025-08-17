// backend/src/services/prismaService.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const prismaService = {
  async healthCheck(): Promise<boolean> {
    try {
      await prisma.module.findFirst({ select: { id: true } });
      logger.debug('Database health check passed');
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  },
};

// Export as DatabaseService for backward compatibility
export const DatabaseService = {
  healthCheck: prismaService.healthCheck,
  // Add other database methods as needed
  async getAllModules() {
    return prisma.module.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },
  async getOrphanedModules() {
    return prisma.module.findMany({
      where: { userId: null }
    });
  },
  async markOrphanedAsFailed() {
    return prisma.module.updateMany({
      where: { userId: null, status: 'UPLOADED' },
      data: { status: 'FAILED', lastError: 'Orphaned module' }
    });
  },
  async cleanupOldFailedModules(daysOld: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    return prisma.module.deleteMany({
      where: { 
        status: 'FAILED',
        updatedAt: { lt: cutoff }
      }
    });
  },
  async getModuleStats() {
    const [total, ready, processing, failed] = await Promise.all([
      prisma.module.count(),
      prisma.module.count({ where: { status: 'READY' } }),
      prisma.module.count({ where: { status: 'PROCESSING' } }),
      prisma.module.count({ where: { status: 'FAILED' } })
    ]);
    return { total, ready, processing, failed };
  },
  // User management methods
  async getUserByClerkId(clerkId: string) {
    return prisma.user.findUnique({ where: { clerkId } });
  },
  async getUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  async createUser(data: { email: string; clerkId?: string }) {
    return prisma.user.create({ data });
  },
  async getModule(moduleId: string) {
    return prisma.module.findUnique({ 
      where: { id: moduleId },
      include: {
        steps: true // Include steps if they exist in the schema
      }
    });
  },
  // Question and vector methods
  async createQuestionWithVector(data: any) {
    return prisma.question.create({ data });
  },
  async findSimilarQuestions(moduleId: string, queryEmbedding: number[], similarityThreshold: number) {
    // TODO: Implement vector similarity search
    return [];
  },
  async findSimilarQuestionsScoped(moduleId: string, queryEmbedding: number[], similarityThreshold: number) {
    // TODO: Implement scoped vector similarity search
    return [];
  },
  async getActivityLogs(userId: string | undefined, limit: number) {
    return prisma.activityLog.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  },
  // Add missing createActivityLog method
  async createActivityLog(data: {
    userId?: string;
    action: string;
    targetId: string;
    metadata?: Record<string, any>;
  }) {
    try {
      return await prisma.activityLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          targetId: data.targetId,
          metadata: data.metadata || {},
          createdAt: new Date(),
        }
      });
    } catch (error) {
      logger.error('Failed to create activity log:', error);
      // Return null instead of throwing to prevent breaking the main flow
      return null;
    }
  },
  // Add method to get steps for a module
  async getSteps(moduleId: string) {
    try {
      // Try to get steps from the steps table first
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' }
      });
      
      if (steps.length > 0) {
        return steps;
      }
      
      // If no steps in the steps table, try to get from S3 or return empty array
      // For now, return empty array - you can implement S3 fallback later
      return [];
    } catch (error) {
      logger.error('Failed to get steps:', error);
      return [];
    }
  },

  // Add missing methods that routes are calling
  async getUserCount() {
    try {
      const count = await prisma.user.count();
      return count;
    } catch (error) {
      logger.error('Failed to get user count:', error);
      return 0;
    }
  },

  async getFeedbackStats() {
    try {
      // Return basic stats for now
      return {
        totalFeedback: 0,
        averageRating: 0,
        feedbackCount: 0
      };
    } catch (error) {
      logger.error('Failed to get feedback stats:', error);
      return { totalFeedback: 0, averageRating: 0, feedbackCount: 0 };
    }
  },

  async getQuestions(moduleId: string, limit: number = 10) {
    try {
      // Return empty array for now - implement when you add questions table
      return [];
    } catch (error) {
      logger.error('Failed to get questions:', error);
      return [];
    }
  },

  async getFAQ(moduleId: string) {
    try {
      // Return empty array for now - implement when you add FAQ table
      return [];
    } catch (error) {
      logger.error('Failed to get FAQ:', error);
      return [];
    }
  },

  async toggleFAQ(questionId: string) {
    try {
      // Return mock response for now
      return { id: questionId, isFAQ: true };
    } catch (error) {
      logger.error('Failed to toggle FAQ:', error);
      return { id: questionId, isFAQ: false };
    }
  },

  async getQuestionHistory(moduleId: string, limit: number) {
    try {
      // Return empty array for now - implement when you add question history
      return [];
    } catch (error) {
      logger.error('Failed to get question history:', error);
      return [];
    }
  },

  // Progress tracking methods
  async saveUserProgress(data: {
    userId: string;
    moduleId: string;
    completedSteps: string[];
    currentStepIndex: number;
    timeSpent: number;
    performanceScore: number;
    learningPace: 'slow' | 'normal' | 'fast';
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  }) {
    try {
      // Create or update progress record
      const progress = await prisma.userProgress.upsert({
        where: {
          userId_moduleId: {
            userId: data.userId,
            moduleId: data.moduleId
          }
        },
        update: {
          completedSteps: data.completedSteps,
          currentStepIndex: data.currentStepIndex,
          timeSpent: data.timeSpent,
          performanceScore: data.performanceScore,
          learningPace: data.learningPace,
          difficultyLevel: data.difficultyLevel,
          updatedAt: new Date()
        },
        create: {
          userId: data.userId,
          moduleId: data.moduleId,
          completedSteps: data.completedSteps,
          currentStepIndex: data.currentStepIndex,
          timeSpent: data.timeSpent,
          performanceScore: data.performanceScore,
          learningPace: data.learningPace,
          difficultyLevel: data.difficultyLevel
        }
      });
      
      logger.info(`✅ User progress saved for module ${data.moduleId}`);
      return progress;
    } catch (error) {
      logger.error('❌ Failed to save user progress:', error);
      throw error;
    }
  }

  async getUserProgress(userId: string, moduleId: string) {
    try {
      const progress = await prisma.userProgress.findUnique({
        where: {
          userId_moduleId: {
            userId,
            moduleId
          }
        }
      });
      
      return progress || {
        completedSteps: [],
        currentStepIndex: 0,
        timeSpent: 0,
        performanceScore: 0,
        learningPace: 'normal' as const,
        difficultyLevel: 'beginner' as const
      };
    } catch (error) {
      logger.error('❌ Failed to get user progress:', error);
      return {
        completedSteps: [],
        currentStepIndex: 0,
        timeSpent: 0,
        performanceScore: 0,
        learningPace: 'normal' as const,
        difficultyLevel: 'beginner' as const
      };
    }
  }

  async updateQuestionsAsked(userId: string, moduleId: string, count: number = 1) {
    try {
      await prisma.userProgress.update({
        where: {
          userId_moduleId: {
            userId,
            moduleId
          }
        },
        data: {
          questionsAsked: {
            increment: count
          }
        }
      });
      
      logger.info(`✅ Questions asked count updated for module ${moduleId}`);
    } catch (error) {
      logger.error('❌ Failed to update questions asked count:', error);
    }
  }

};

export default prisma;
