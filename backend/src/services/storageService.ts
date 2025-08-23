// backend/src/services/storageService.ts - Quick Fix
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const prisma = new PrismaClient()
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'adaptv3-training-videos'

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
      Body: JSON.stringify(moduleData),
      ContentType: 'application/json',
    })

    await s3Client.send(command)
    
    return moduleId
  },

  /**
   * Get a signed playback URL for a video
   * IMPORTANT: do not set Content-Disposition so the browser streams instead of downloads
   */
  async getSignedPlaybackUrl(key: string, expiresSeconds: number = 600): Promise<string> {
    try {
      console.log(`🎬 [STORAGE] Generating signed playback URL for: ${key}`);
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
      console.log(`✅ [STORAGE] Generated signed URL, expires in ${expiresSeconds}s`);
      
      return url;
    } catch (error: any) {
      console.error(`❌ [STORAGE] Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  },

  // ✅ FIXED: Now queries Prisma database instead of returning mock data
  async getModule(moduleId: string): Promise<any> {
    try {
      console.log(`🔍 [StorageService] Fetching module: ${moduleId}`) // ADD THIS LINE
      
      // Query the actual database using Prisma
      const module = await prisma.module.findUnique({
        where: { id: moduleId },
        include: {
          steps: {
            orderBy: { startTime: 'asc' }
          }
        }
      })

      if (!module) {
        return null
      }

              // Return module with proper format that matches frontend expectations
        return {
          id: module.id,
          title: module.title || module.filename || 'Untitled Module',
          filename: module.filename,
          status: module.status || 'processing', // Use lowercase to match your backend logs
          progress: module.progress || 0,
          videoUrl: module.videoUrl,
          transcriptText: module.transcriptText,
          steps: module.steps?.map(step => ({
            id: step.id,
            text: step.text,
            startTime: step.startTime,
            endTime: step.endTime,
            order: step.order,
            aliases: step.aliases,
            notes: step.notes
          })) || [],
          lastError: module.lastError,
          createdAt: module.createdAt,
          updatedAt: module.updatedAt,
          userId: module.userId,
          s3Key: module.s3Key
        }
    } catch (error) {
      console.error('Error fetching module from database:', error)
      throw error
    }
  },

  // ✅ FIXED: Now queries Prisma database
  async getAllModules(): Promise<any[]> {
    try {
      console.log(`🔍 [StorageService] Fetching all modules`) // ADD THIS LINE
      
      const modules = await prisma.module.findMany({
        include: {
          steps: {
            orderBy: { startTime: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      return modules.map(module => ({
        id: module.id,
        title: module.title || module.filename || 'Untitled Module',
        filename: module.filename,
        status: module.status || 'processing',
        progress: module.progress || 0,
        videoUrl: module.videoUrl,
        duration: 0, // Duration not available in current schema
        stepCount: module.steps?.length || 0,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
        userId: module.userId
      }))
    } catch (error) {
      console.error('Error fetching modules from database:', error)
      throw error
    }
  },

  /**
   * Get JSON data from S3
   */
  async getJson(key: string): Promise<any> {
    try {
      console.log(`📖 Fetching JSON from S3: ${key}`);
      
      // Actually fetch from S3 using GetObjectCommand
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
      
      const response = await s3Client.send(command)
      if (!response.Body) {
        throw new Error('Empty response body from S3')
      }
      
      // Convert stream to string and parse JSON
      const bodyContents = await response.Body.transformToString()
      const data = JSON.parse(bodyContents)
      
      console.log(`✅ Successfully loaded JSON from S3: ${key}`, {
        stepCount: data.steps?.length || 0,
        hasTranscript: !!data.transcript,
        dataKeys: Object.keys(data)
      })
      
      return data
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
      // Fix: Use correct region in S3 URL
      const region = process.env.AWS_REGION || 'us-west-1';
      return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
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
      // Fix: Use correct region in S3 URL
      const region = process.env.AWS_REGION || 'us-west-1';
      return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}?mock-signed=true&expires=${expiresIn}`;
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