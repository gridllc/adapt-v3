// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

// Configure S3 client with proper error handling
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 3, // Retry failed requests
  retryMode: 'adaptive'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'adapt-videos';

export const storageService = {
  /**
   * Upload video to S3 with proper error handling and validation
   */
  async uploadVideo(file: Express.Multer.File): Promise<string> {
    const key = `videos/${uuidv4()}-${this.sanitizeFilename(file.originalname)}`;

    try {
      console.log(`📤 Uploading to S3: ${key} (${file.size} bytes)`);

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: 'inline', // Allows direct playback in browser
        CacheControl: 'max-age=31536000', // Cache for 1 year
        Metadata: {
          'original-name': file.originalname,
          'upload-timestamp': new Date().toISOString(),
          'file-size': file.size.toString()
        }
      });

      await s3Client.send(command);

      const videoUrl = this.getS3Url(key);
      console.log(`✅ Upload successful: ${videoUrl}`);

      // Verify upload by checking if object exists
      try {
        await this.verifyUpload(key);
      } catch (verifyError) {
        console.warn('⚠️ Upload verification failed, but upload may have succeeded:', verifyError);
      }

      return videoUrl;

    } catch (error: any) {
      console.error('❌ S3 upload failed:', error);

      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket '${BUCKET_NAME}' does not exist`);
      } else if (error.name === 'AccessDenied') {
        throw new Error('S3 access denied - check your AWS credentials');
      } else if (error.name === 'InvalidAccessKeyId') {
        throw new Error('Invalid AWS access key ID');
      } else if (error.name === 'SignatureDoesNotMatch') {
        throw new Error('Invalid AWS secret access key');
      } else if (error.name === 'RequestTimeout' || error.code === 'TimeoutError') {
        throw new Error('S3 upload timed out - please try again');
      } else if (error.name === 'NetworkingError') {
        throw new Error('Network error during upload - check your connection');
      } else {
        throw new Error(`S3 upload failed: ${error.message}`);
      }
    }
  },

  /**
   * Save module data to S3
   */
  async saveModule(moduleData: any): Promise<string> {
    const moduleId = uuidv4();
    const key = `modules/${moduleId}.json`;

    try {
      console.log(`💾 Saving module: ${moduleId}`);

      // Add metadata to module data
      const enrichedModuleData = {
        ...moduleData,
        id: moduleId,
        createdAt: new Date().toISOString(),
        version: '1.0'
      };

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(enrichedModuleData, null, 2),
        ContentType: 'application/json',
        CacheControl: 'max-age=3600', // Cache for 1 hour
        Metadata: {
          'module-id': moduleId,
          'created-timestamp': new Date().toISOString()
        }
      });

      await s3Client.send(command);
      console.log(`✅ Module saved: ${moduleId}`);

      return moduleId;

    } catch (error: any) {
      console.error('❌ Module save failed:', error);
      throw new Error(`Failed to save module: ${error.message}`);
    }
  },

  /**
   * Get module data from S3
   */
  async getModule(moduleId: string): Promise<any> {
    const key = `modules/${moduleId}.json`;

    try {
      console.log(`📖 Fetching module: ${moduleId}`);

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response from S3');
      }

      const bodyContents = await response.Body.transformToString();
      const moduleData = JSON.parse(bodyContents);

      console.log(`✅ Module fetched: ${moduleId}`);
      return moduleData;

    } catch (error: any) {
      console.error(`❌ Failed to fetch module ${moduleId}:`, error);

      if (error.name === 'NoSuchKey') {
        throw new Error(`Module ${moduleId} not found`);
      } else {
        throw new Error(`Failed to fetch module: ${error.message}`);
      }
    }
  },

  /**
   * Get all modules (this would typically use a database in production)
   */
  async getAllModules(): Promise<any[]> {
    // In a real app, this would query a database
    // For now, return mock data with proper structure
    return [
      {
        id: '1',
        title: 'Coffee Maker Training',
        description: 'Learn how to use your coffee maker',
        videoUrl: 'https://example.com/coffee.mp4',
        createdAt: new Date().toISOString(),
        status: 'READY',
        steps: []
      },
      {
        id: '2',
        title: 'Fire TV Remote',
        description: 'Master your Fire TV remote controls',
        videoUrl: 'https://example.com/firetv.mp4',
        createdAt: new Date().toISOString(),
        status: 'READY',
        steps: []
      },
    ];
  },

  /**
   * Verify that an upload was successful
   */
  async verifyUpload(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        throw new Error('Upload verification failed - file not found in S3');
      } else {
        throw new Error(`Upload verification failed: ${error.message}`);
      }
    }
  },

  /**
   * Check S3 connection and bucket access
   */
  async healthCheck(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to list objects in the bucket (with limit 1 to minimize cost)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        MaxKeys: 1
      });

      await s3Client.send(command);

      return {
        success: true,
        message: `S3 connection healthy, bucket '${BUCKET_NAME}' accessible`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `S3 health check failed: ${error.message}`
      };
    }
  },

  /**
   * Generate S3 URL for a key
   */
  getS3Url(key: string): string {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  },

  /**
   * Sanitize filename for S3 key
   */
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .toLowerCase();
  },

  /**
   * Save JSON data to S3
   */
  async putJson(key: string, data: any): Promise<string> {
    try {
      console.log(`💾 Saving JSON to S3: ${key}`);

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
        CacheControl: 'max-age=3600'
      });

      await s3Client.send(command);
      return this.getS3Url(key);
    } catch (error: any) {
      console.error('❌ Failed to save JSON to S3:', error);
      throw new Error(`Failed to save JSON: ${error?.message || error}`);
    }
  },

  /**
   * Get JSON data from S3
   */
  async getJson(key: string): Promise<any> {
    try {
      console.log(`📖 Fetching JSON from S3: ${key}`);

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      const response = await s3Client.send(command);
      const body = await response.Body?.transformToString();
      
      if (!body) {
        throw new Error('Empty response body');
      }

      return JSON.parse(body);
    } catch (error: any) {
      console.error('❌ Failed to fetch JSON from S3:', error);
      throw new Error(`Failed to fetch JSON: ${error?.message || error}`);
    }
  },

  /**
   * Get S3 object metadata
   */
  async headObject(key: string): Promise<any> {
    try {
      console.log(`🔍 Getting S3 object metadata: ${key}`);

      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      return await s3Client.send(command);
    } catch (error: any) {
      console.error('❌ Failed to get S3 object metadata:', error);
      throw new Error(`Failed to get metadata: ${error?.message || error}`);
    }
  },

  /**
   * Generate signed URL for S3 object
   */
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      console.log(`🔗 Generating signed URL for: ${key}, expires in ${expiresIn}s`);

      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error: any) {
      console.error('❌ Failed to generate signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error?.message || error}`);
    }
  },

  /**
   * Get signed S3 URL (alias for generateSignedUrl)
   */
  async getSignedS3Url(key: string, expiresIn: number = 3600): Promise<string> {
    return this.generateSignedUrl(key, expiresIn);
  }
};