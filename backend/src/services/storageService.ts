// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos'

// In-memory storage for development (replace with database in production)
const moduleStore = new Map<string, any>()

export const storageService = {
  async uploadVideo(file: Express.Multer.File): Promise<string> {
    const key = `videos/${uuidv4()}-${file.originalname}`

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })

      await s3Client.send(command)

      return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
    } catch (error) {
      console.error('S3 upload error:', error)
      // For development, create a blob URL as fallback
      const blob = new Blob([file.buffer], { type: file.mimetype })
      return URL.createObjectURL(blob)
    }
  },

  async uploadVideoWithKey(file: Express.Multer.File, s3Key: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })

      await s3Client.send(command)
      return `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`
    } catch (error) {
      console.error('S3 upload error:', error)
      throw error
    }
  },

  async putJson(key: string, data: any): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      })

      await s3Client.send(command)
    } catch (error) {
      console.error('S3 putJson error:', error)
      throw error
    }
  },

  async getJson(key: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      const response = await s3Client.send(command)
      const body = await response.Body?.transformToString()

      if (body) {
        return JSON.parse(body)
      }
      return null
    } catch (error) {
      console.error('S3 getJson error:', error)
      return null
    }
  },

  async headObject(key: string): Promise<any> {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      const response = await s3Client.send(command)
      return response
    } catch (error) {
      console.error('S3 headObject error:', error)
      throw error
    }
  },

  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn })
      return signedUrl
    } catch (error) {
      console.error('S3 generateSignedUrl error:', error)
      throw error
    }
  },

  async saveModule(moduleData: any): Promise<string> {
    const moduleId = uuidv4()
    const moduleWithId = {
      ...moduleData,
      id: moduleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      // Try to save to S3
      const key = `modules/${moduleId}.json`

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(moduleWithId),
        ContentType: 'application/json',
      })

      await s3Client.send(command)
    } catch (error) {
      console.error('S3 save error, using memory storage:', error)
    }

    // Always save to memory store for immediate access
    moduleStore.set(moduleId, moduleWithId)

    return moduleId
  },

  async getModule(moduleId: string): Promise<any> {
    // First check memory store
    if (moduleStore.has(moduleId)) {
      return moduleStore.get(moduleId)
    }

    // Then try S3
    try {
      const key = `modules/${moduleId}.json`
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      const response = await s3Client.send(command)
      const body = await response.Body?.transformToString()

      if (body) {
        const module = JSON.parse(body)
        moduleStore.set(moduleId, module) // Cache in memory
        return module
      }
    } catch (error) {
      console.error('S3 get error:', error)
    }

    // Return null if not found
    return null
  },

  async getAllModules(): Promise<any[]> {
    // For now, return modules from memory store
    // In production, this would query a database or list S3 objects
    return Array.from(moduleStore.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  },

  async deleteModule(moduleId: string): Promise<void> {
    // Remove from memory store
    moduleStore.delete(moduleId)

    // Try to delete from S3
    try {
      const key = `modules/${moduleId}.json`
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })

      await s3Client.send(command)
    } catch (error) {
      console.error('S3 delete error:', error)
    }
  },
}

// Export individual functions for backward compatibility
export const getSignedS3Url = async (filename: string): Promise<string> => {
  return storageService.generateSignedUrl(filename, 3600)
}