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
    return prisma.module.findUnique({ where: { id: moduleId } });
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
  }
};

export default prisma;
