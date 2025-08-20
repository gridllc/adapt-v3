// backend/src/services/storageService.ts - Quick Fix
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos'

// Track when modules were created (in-memory for now)
const moduleCreationTimes = new Map<string, number>()

export const storageService = {
  /**
   * Simple utility to upload any content to S3
   */
  async putObject(key: string, content: string, contentType: string = 'application/json'): Promise<void> {
    try {
      console.log(`📤 [STORAGE] Uploading to S3: ${key}`);
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: 'max-age=3600', // Cache for 1 hour
      });

      await s3Client.send(command);
      console.log(`✅ [STORAGE] Upload successful: ${key}`);
    } catch (error: any) {
      console.error(`❌ [STORAGE] S3 upload failed for ${key}:`, error);
      throw new Error(`Failed to upload ${key}: ${error.message}`);
    }
  },

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    const key = `videos/${uuidv4()}-${file.originalname}`
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })

    await s3Client.send(command)
    
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
  },

  async saveModule(moduleData: any): Promise<string> {
    const moduleId = uuidv4()
    const key = `modules/${moduleId}.json`
    
    // Track creation time
    moduleCreationTimes.set(moduleId, Date.now())
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify({
        ...moduleData,
        status: 'processing'
      }),
      ContentType: 'application/json',
    })

    await s3Client.send(command)
    
    return moduleId
  },

  async getModule(moduleId: string): Promise<any> {
    const creationTime = moduleCreationTimes.get(moduleId)
    const now = Date.now()
    
    // If no creation time recorded, assume it was just created
    if (!creationTime) {
      moduleCreationTimes.set(moduleId, now)
      console.log(`Setting creation time for module ${moduleId}`)
    }
    
    const actualCreationTime = moduleCreationTimes.get(moduleId) || now
    const timeSinceCreation = now - actualCreationTime
    
    console.log(`Module ${moduleId}: ${timeSinceCreation}ms since creation`)
    
    // Simulate processing time - after 10 seconds, return ready status
    const isProcessing = timeSinceCreation < 10000 // 10 seconds
    
    if (isProcessing) {
      console.log(`Module ${moduleId} still processing (${timeSinceCreation}ms < 10000ms)`)
      return {
        id: moduleId,
        title: 'Processing Video...',
        description: 'AI is analyzing your video and extracting steps',
        status: 'processing',
        steps: []
      }
    }
    
    // After "processing", return completed module
    console.log(`Module ${moduleId} processing complete (${timeSinceCreation}ms >= 10000ms)`)
    return {
      id: moduleId,
      title: 'Your Training Module',
      description: 'AI-generated training module from your uploaded video',
      status: 'ready',
      videoUrl: 'https://example.com/video.mp4',
      steps: [
        {
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome to the training - this step was extracted by AI',
          duration: 30,
        },
        {
          timestamp: 30,
          title: 'Main Content',
          description: 'The main content of your training video',
          duration: 60,
        },
        {
          timestamp: 90,
          title: 'Conclusion',
          description: 'Wrapping up the training session',
          duration: 30,
        }
      ],
    }
  },

  async getAllModules(): Promise<any[]> {
    return [
      {
        id: '1',
        title: 'Coffee Maker Training',
        description: 'Learn how to use your coffee maker',
        videoUrl: 'https://example.com/coffee.mp4',
      },
      {
        id: '2',
        title: ' Fire TV Remote',
        description: 'Master your Fire TV remote controls',
        videoUrl: 'https://example.com/firetv.mp4',
      },
    ]
  },

  /**
   * Get JSON data from S3
   */
  async getJson(key: string): Promise<any> {
    try {
      console.log(`📖 Fetching JSON from S3: ${key}`);
      
      // For now, return mock data since we're not actually using S3
      // In production, this would fetch from S3
      return {
        steps: [
          {
            timestamp: 0,
            title: 'Introduction',
            description: 'Welcome to the training - this step was extracted by AI',
            duration: 30,
          },
          {
            timestamp: 30,
            title: 'Main Content',
            description: 'The main content of your training video',
            duration: 60,
          },
          {
            timestamp: 90,
            title: 'Conclusion',
            description: 'Wrapping up the training session',
            duration: 30,
          }
        ],
        transcript: 'This is a mock transcript for testing purposes.',
        meta: { duration: 120, keyFrameCount: 3 }
      };
    } catch (error: any) {
      console.error(`❌ Failed to fetch JSON from S3: ${key}:`, error);
      throw new Error(`Failed to fetch JSON: ${error?.message || error}`);
    }
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
      return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    } catch (error: any) {
      console.error('❌ Failed to save JSON to S3:', error);
      throw new Error(`Failed to save JSON: ${error?.message || error}`);
    }
  },

  /**
   * Get S3 object metadata
   */
  async headObject(key: string): Promise<any> {
    try {
      console.log(`🔍 Getting S3 object metadata: ${key}`);
      
      // For now, return mock metadata since we're not actually using S3
      // In production, this would fetch from S3
      return {
        ContentLength: 1024,
        LastModified: new Date(),
        ETag: '"mock-etag"'
      };
    } catch (error: any) {
      console.error(`❌ Failed to get S3 object metadata: ${key}:`, error);
      throw new Error(`Failed to get metadata: ${error?.message || error}`);
    }
  },

  /**
   * Generate signed URL for S3 object
   */
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      console.log(`🔗 Generating signed URL for: ${key}, expires in ${expiresIn}s`);
      
      // For now, return mock signed URL since we're not actually using S3
      // In production, this would generate a real signed URL
      return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}?mock-signed=true&expires=${expiresIn}`;
    } catch (error: any) {
      console.error(`❌ Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error?.message || error}`);
    }
  },

  /**
   * Get signed S3 URL (alias for generateSignedUrl)
   */
  async getSignedS3Url(key: string, expiresIn: number = 3600): Promise<string> {
    return this.generateSignedUrl(key, expiresIn);
  }
}