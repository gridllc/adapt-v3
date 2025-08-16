// backend/src/routes/healthRoutes.ts
import express from 'express';
import prisma from '../services/prismaService.js';
import { isS3Configured } from '../services/s3Uploader.js';
import { logger } from '../utils/logger';

const router = express.Router();

router.get('/health', async (_req, res) => {
  const healthStatus: Record<string, string> = {};
  let overallStatus = 200;

  try {
    try {
      await prisma.module.findFirst({
        where: { s3Key: { not: '' }, stepsKey: { not: '' } },
        select: { id: true },
      });
      healthStatus.postgres = 'Connected';
    } catch (dbError) {
      healthStatus.postgres = 'Failed';
      logger.warn('Postgres check failed', dbError);
      overallStatus = 500;
    }

    try {
      healthStatus.storage = isS3Configured() ? 'Configured' : 'Missing';
    } catch (s3Error) {
      healthStatus.storage = 'Error';
      logger.warn('S3 config check error', s3Error);
    }

    try {
      healthStatus.qstash = process.env.QSTASH_TOKEN ? 'Configured' : 'Missing';
    } catch (qstashError) {
      healthStatus.qstash = 'Error';
      logger.warn('QStash config check error', qstashError);
    }

    const requiredEnvVars = ['DATABASE_URL', 'CLERK_SECRET_KEY'];
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    healthStatus.environment = missing.length === 0 ? 'Valid' : `Missing: ${missing.join(', ')}`;
    if (missing.length > 0) overallStatus = 500;

    return res.status(overallStatus).json({
      status: overallStatus === 200 ? 'healthy' : 'unhealthy',
      services: healthStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health route error', error);
    return res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
