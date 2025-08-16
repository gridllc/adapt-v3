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

export default prisma;
