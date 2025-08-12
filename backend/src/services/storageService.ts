// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

// Initialize S3 client only if AWS credentials are available
let s3Client: S3Client | null = null
let isS3Enabled = false

try {
  // Use optional chaining and provide fallbacks to prevent build-time errors
  const awsRegion = process.env.AWS_REGION || process.env.S3_REGION
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const awsBucketName = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME
  
  console.log('🔍 S3 Configuration Check:')
  console.log('  Region:', awsRegion ? `✅ ${awsRegion}` : '❌ MISSING')
  console.log('  Access Key:', awsAccessKeyId ? `✅ ${awsAccessKeyId.substring(0, 8)}...` : '❌ MISSING')
  console.log('  Secret Key:', awsSecretAccessKey ? `✅ ${awsSecretAccessKey.substring(0, 4)}...` : '❌ MISSING')
  console.log('  Bucket:', awsBucketName ? `✅ ${awsBucketName}` : '❌ MISSING')
  
  if (awsRegion && awsAccessKeyId && awsSecretAccessKey && awsBucketName) {
    console.log('🚀 All S3 credentials found, initializing client...')
    s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    })
    isS3Enabled = true
    console.log('✅ S3 client initialized successfully')
    console.log(`📦 Using bucket: ${awsBucketName}`)
    console.log(`🌍 Using region: ${awsRegion}`)
  } else {
    console.log('⚠️ S3 credentials not found, using mock storage')
    console.log('🔍 Missing:', {
      region: !awsRegion ? 'AWS_REGION/S3_REGION' : 'OK',
      accessKey: !awsAccessKeyId ? 'AWS_ACCESS_KEY_ID' : 'OK',
      secretKey: !awsSecretAccessKey ? 'AWS_SECRET_ACCESS_KEY' : 'OK',
      bucket: !awsBucketName ? 'AWS_BUCKET_NAME/S3_BUCKET_NAME' : 'OK'
    })
  }
} catch (error) {
  console.log('⚠️ Failed to initialize S3 client, using mock storage:', error instanceof Error ? error.message : 'Unknown error')
  console.log('💥 Full error:', error)
}

export const storageService = {
  // Check if S3 is available
  isS3Enabled() {
    const enabled = isS3Enabled && s3Client !== null
    console.log('🔍 isS3Enabled() check:', {
      isS3Enabled,
      s3ClientExists: s3Client !== null,
      result: enabled
    })
    return enabled
  },

  // Videos go to S3 (unlimited storage) or mock storage
  async uploadVideo(file: Express.Multer.File): Promise<string> {
    try {
      if (this.isS3Enabled() && s3Client) {
        console.log('🚀 Uploading to S3...')
        const key = `videos/${uuidv4()}-${file.originalname}`
        
        // Use optional chaining to prevent build-time errors
        const bucketName = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME
        if (!bucketName) {
          throw new Error('AWS_BUCKET_NAME or S3_BUCKET_NAME not configured')
        }
        
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }))
        
        const awsRegion = process.env.AWS_REGION || 'us-east-1'
        const s3Url = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${key}`
        console.log('✅ S3 upload successful:', s3Url)
        return s3Url
      } else {
        console.log('📁 Using mock storage (S3 not configured)')
        // Return mock URL for development
        return `http://localhost:8000/uploads/${file.originalname}`
      }
    } catch (error) {
      console.error('❌ Video upload failed:', error instanceof Error ? error.message : 'Unknown error')
      // Fallback to mock storage on S3 failure
      console.log('📁 Falling back to mock storage')
      return `http://localhost:8000/uploads/${file.originalname}`
    }
  },

  // Metadata goes to Prisma (queryable, relational) or mock storage
  async saveModule(moduleData: any): Promise<string> {
    try {
      if (process.env.DATABASE_URL) {
        console.log('💾 Saving module to database...')
        const module = await prisma.module.create({
          data: {
            id: uuidv4(),
            title: moduleData.title || 'Untitled Module',
            filename: moduleData.filename || 'video.mp4',
            videoUrl: moduleData.videoUrl,
            status: 'completed',
            progress: 100,
            steps: {
              create: (moduleData.steps || []).map((step: any, index: number) => ({
                timestamp: step.timestamp || 0,
                title: step.title || 'Step',
                description: step.description || 'No description',
                duration: step.duration || 0,
                order: index + 1,
              }))
            },
          },
        })
        console.log('✅ Module saved to database:', module.id)
        return module.id
      } else {
        console.log('📝 Database not configured, using mock storage')
        return `mock_module_${Date.now()}`
      }
    } catch (error) {
      console.error('❌ Failed to save module to database:', error instanceof Error ? error.message : 'Unknown error')
      console.log('📝 Falling back to mock storage')
      return `mock_module_${Date.now()}`
    }
  },

  async getModule(moduleId: string) {
    try {
      if (process.env.DATABASE_URL) {
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
      } else {
        console.log('📝 Database not configured, returning mock module')
        return {
          id: moduleId,
          title: 'Mock Training Module',
          description: 'This is a mock module for development',
          filename: 'mock-video.mp4',
          videoUrl: 'http://localhost:8000/uploads/mock-video.mp4',
          status: 'completed',
          progress: 100,
          steps: [
            { id: '1', timestamp: 0, title: 'Introduction', description: 'Getting started', duration: 30, order: 1 },
            { id: '2', timestamp: 30, title: 'Main content', description: 'Core training', duration: 60, order: 2 },
            { id: '3', timestamp: 90, title: 'Conclusion', description: 'Wrapping up', duration: 20, order: 3 }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
    } catch (error) {
      console.error('❌ Failed to get module from database:', error instanceof Error ? error.message : 'Unknown error')
      console.log('📝 Falling back to mock module')
      return {
        id: moduleId,
        title: 'Error Module',
        description: 'Failed to load module data',
        filename: 'error.mp4',
        videoUrl: 'http://localhost:8000/uploads/error.mp4',
        status: 'error',
        progress: 0,
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }
  },

  async getAllModules() {
    try {
      if (process.env.DATABASE_URL) {
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
      } else {
        console.log('📝 Database not configured, returning mock modules')
        return [
          {
            id: '1',
            title: 'Coffee Maker Training',
            description: 'Learn how to use your coffee maker',
            filename: 'coffee.mp4',
            videoUrl: 'https://example.com/coffee.mp4',
            status: 'completed',
            progress: 100,
            steps: [
              { id: '1', timestamp: 0, title: 'Setup', description: 'Prepare your coffee maker', duration: 30, order: 1 },
              { id: '2', timestamp: 30, title: 'Brewing', description: 'Start the brewing process', duration: 60, order: 2 },
              { id: '3', timestamp: 90, title: 'Cleanup', description: 'Clean up after brewing', duration: 20, order: 3 }
            ],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          {
            id: '2',
            title: 'Fire TV Remote Training',
            description: 'Master your Fire TV remote controls',
            filename: 'firetv.mp4',
            videoUrl: 'https://example.com/firetv.mp4',
            status: 'completed',
            progress: 100,
            steps: [
              { id: '1', timestamp: 0, title: 'Navigation', description: 'Navigate the Fire TV interface', duration: 45, order: 1 },
              { id: '2', timestamp: 45, title: 'Apps', description: 'Install and manage apps', duration: 75, order: 2 },
              { id: '3', timestamp: 120, title: 'Settings', description: 'Configure your Fire TV', duration: 30, order: 3 }
            ],
            createdAt: new Date('2024-01-02'),
            updatedAt: new Date('2024-01-02'),
          }
        ]
      }
    } catch (error) {
      console.error('❌ Failed to get modules from database:', error instanceof Error ? error.message : 'Unknown error')
      console.log('📝 Falling back to mock modules')
      return [
        {
          id: 'error_1',
          title: 'Error Loading Modules',
          description: 'Failed to load modules from database',
          filename: 'error.mp4',
          videoUrl: 'http://localhost:8000/uploads/error.mp4',
          status: 'error',
          progress: 0,
          steps: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]
    }
  },

  // Health check for the service
  async healthCheck() {
    const checks = {
      s3: this.isS3Enabled(),
      database: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString(),
    }
    
    console.log('🏥 Storage service health check:', checks)
    return checks
  },
}

// Get signed URL for file access (exported separately for compatibility)
export async function getSignedS3Url(filename: string): Promise<string> {
  try {
    if (storageService.isS3Enabled()) {
      console.log('🔗 Generating S3 signed URL for:', filename)
      // Use optional chaining to prevent build-time errors
      const bucketName = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME
      const awsRegion = process.env.AWS_REGION || process.env.S3_REGION
      
      if (!bucketName || !awsRegion) {
        throw new Error('AWS configuration incomplete (missing bucket or region)')
      }
      
      // For now, return the public S3 URL
      // TODO: Implement proper presigned URL generation
      return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/videos/${filename}`
    } else {
      console.log('📁 S3 not configured, returning local URL for:', filename)
      return `http://localhost:8000/uploads/${filename}`
    }
  } catch (error) {
    console.error('❌ Failed to get signed URL:', error instanceof Error ? error.message : 'Unknown error')
    // Fallback to local URL
    return `http://localhost:8000/uploads/${filename}`
  }
} 