// backend/src/services/s3Service.ts
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Client, isS3Configured } from './s3Uploader.js';
import { logger } from '../utils/logger.js';

export { s3Client as s3 };

export async function checkS3Health(): Promise<boolean> {
  try {
    if (!isS3Configured() || !process.env.AWS_BUCKET_NAME) {
      logger.debug('S3 not configured — skipping health check');
      return false;
    }

    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET_NAME,
      MaxKeys: 1,
    });

    await s3Client().send(command);
    logger.info(`S3 health check passed: ${process.env.AWS_BUCKET_NAME}`);
    return true;
  } catch (error) {
    logger.error('S3 health check failed', error);
    return false;
  }
} 
