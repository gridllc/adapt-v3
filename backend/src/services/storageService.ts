// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { uploadToS3, getPresignedUrl } from './s3Uploader.js'
import { prisma } from '../config/database.js'

// Initialize S3 client - REQUIRE credentials (no mock fallbacks!)
const awsRegion = process.env.AWS_REGION
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const awsBucketName = process.env.AWS_BUCKET_NAME

if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !awsBucketName) {
  throw new Error('S3 credentials are REQUIRED. No mock fallbacks allowed.')
}

const s3Client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
})

console.log('✅ S3 client initialized successfully (no fallbacks!)')
console.log(`📦 Using bucket: ${awsBucketName}`)
console.log(`🌍 Using region: ${awsRegion}`)

// CRITICAL: Simple storage service - NO PLACEHOLDERS, NO MOCKS
export const storageService = {
  // Generate signed URL for reading S3 objects (required for real videos)
  async generateSignedUrl(key: string, expiresIn = 900): Promise<string> {
    console.log('🔗 Generating S3 signed URL for:', key)

    const command = new GetObjectCommand({ Bucket: awsBucketName, Key: key })
    const url = await getSignedUrl(s3Client, command, { expiresIn })

    console.log('✅ Signed URL generated successfully')
    return url
  },

  // Get S3 object metadata (HEAD request)
  async headObject(key: string): Promise<any> {
    console.log('🔍 Getting S3 object metadata for:', key)

    const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
    const command = new HeadObjectCommand({ Bucket: awsBucketName, Key: key })
    const result = await s3Client.send(command)

    console.log('✅ S3 head successful:', { ContentLength: result.ContentLength, ContentType: result.ContentType })
    return result
  },

  // Get JSON content from S3 object (only real data!)
  async getJson(key: string): Promise<any> {
    console.log('📖 Getting JSON from S3 for:', key)

    const command = new GetObjectCommand({ Bucket: awsBucketName, Key: key })
    const result = await s3Client.send(command)

    if (!result.Body) {
      throw new Error('No body in S3 response')
    }

    const bodyContent = await result.Body.transformToString()
    const jsonData = JSON.parse(bodyContent)

    console.log('✅ JSON retrieved successfully from S3:', key)
    return jsonData
  },

  // Store JSON content to S3 object (only real data!)
  async putJson(key: string, data: any): Promise<void> {
    console.log('💾 Storing JSON to S3 for:', key)

    const jsonString = JSON.stringify(data, null, 2)
    const command = new PutObjectCommand({
      Bucket: awsBucketName,
      Key: key,
      Body: jsonString,
      ContentType: 'application/json'
    })

    await s3Client.send(command)
    console.log('✅ JSON stored successfully to S3:', key)
  },

  // Upload video to S3 (required for real operation - no mock fallbacks!)
  async uploadVideo(file: Express.Multer.File): Promise<string> {
    console.log('🚀 Uploading video to S3...')
    const key = `videos/${uuidv4()}-${file.originalname}`

    const s3Url = await uploadToS3(file.buffer, key, file.mimetype)
    console.log('✅ S3 upload successful:', s3Url)
    return s3Url
  },

  // Upload video with a specific S3 key (required for real operation)
  async uploadVideoWithKey(file: Express.Multer.File, s3Key: string): Promise<string> {
    console.log('🚀 Uploading video with specific key:', s3Key)

    const s3Url = await uploadToS3(file.buffer, s3Key, file.mimetype)
    console.log('✅ S3 upload successful with key:', s3Key)
    return s3Url
  },

  // Save module to database (required for real operation)
  async saveModule(moduleData: any, userId?: string): Promise<string> {
    console.log('💾 Saving module to database...')
    const module = await prisma.module.create({
      data: {
        id: moduleData.id || uuidv4(),
        title: moduleData.title || 'Untitled Module',
        filename: moduleData.filename || 'video.mp4',
        videoUrl: moduleData.videoUrl,
        s3Key: (moduleData as any).s3Key || '',
        stepsKey: (moduleData as any).stepsKey || `training/${moduleData.id || uuidv4()}.json`,
        status: (moduleData.status as any) || 'UPLOADED',
        progress: moduleData.progress || 0,
        userId: userId || null,
      } as any,
    })
    console.log('✅ Module saved to database:', module.id)
    return module.id
  },

  // Get module from database (fail fast if not found - no mock data!)
  async getModule(moduleId: string) {
    console.log('🔍 Fetching module from database:', moduleId)
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!module) {
      console.log('❌ Module not found in database:', moduleId)
      return null
    }

    console.log('✅ Module found in database:', moduleId)
    return {
      ...module,
      steps: module.steps || [],
    }
  },

  // Get all modules from database (fail fast if database not available)
  async getAllModules() {
    console.log('🔍 Fetching all modules from database...')
    const modules = await prisma.module.findMany({
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`✅ Found ${modules.length} modules in database`)
    return modules.map(module => ({
      ...module,
      steps: module.steps || [],
    }))
  },

  // Health check for the service (requires real services)
  async healthCheck() {
    const checks = {
      s3: true, // Always true since we require S3
      database: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString(),
    }

    console.log('🏥 Storage service health check:', checks)
    return checks
  },
}

// Get signed URL for file access (requires real S3)
export async function getSignedS3Url(filename: string): Promise<string> {
  console.log('🔗 Generating S3 signed URL for:', filename)

  // Assume filename is the full S3 key
  let key = filename

  // If filename doesn't start with 'videos/', assume it's just the original filename
  if (!filename.startsWith('videos/')) {
    key = `videos/${filename}`
  }

  console.log('🔑 Using S3 key for signed URL:', key)

  const { GetObjectCommand } = await import('@aws-sdk/client-s3')
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

  const command = new GetObjectCommand({ Bucket: awsBucketName, Key: key })
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour

  console.log('✅ Signed URL generated successfully')
  return url
} 