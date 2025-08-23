// backend/src/services/storageService.ts - Quick Fix
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

// Fix: Use the correct bucket name that matches the rest of the codebase
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adaptv3-training-videos'

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
    const key = `training/${uuidv4()}-${file.originalname}`
    
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

      const url = await getSignedUrl(s3Client, command, { expiresIn: expiresSeconds });
      console.log(`✅ [STORAGE] Generated signed URL, expires in ${expiresSeconds}s`);
      
      return url;
    } catch (error: any) {
      console.error(`❌ [STORAGE] Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  },

  async getModule(moduleId: string): Promise<any> {
    console.log(`📖 [STORAGE] Getting module ${moduleId} from database`)
    
    // Get the real module from database instead of returning mock data
    try {
      const { ModuleService } = await import('./moduleService.js')
      const module = await ModuleService.get(moduleId)
      
      if (!module) {
        console.warn(`⚠️ [STORAGE] Module ${moduleId} not found in database`)
        return null
      }
      
      console.log(`✅ [STORAGE] Retrieved module ${moduleId} from database:`, {
        status: module.status,
        hasS3Key: !!module.s3Key,
        hasStepsKey: !!module.stepsKey
      })
      
      return module
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to get module ${moduleId} from database:`, error)
      return null
    }
  },

  async getAllModules(): Promise<any[]> {
    console.log(`📚 [STORAGE] Getting all modules from database`)
    
    try {
      const { ModuleService } = await import('./moduleService.js')
      const modules = await ModuleService.getAllModules()
      
      console.log(`✅ [STORAGE] Retrieved ${modules.length} modules from database`)
      return modules
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to get all modules:`, error)
      return []
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