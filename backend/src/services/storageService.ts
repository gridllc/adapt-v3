// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'adapt-videos'

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