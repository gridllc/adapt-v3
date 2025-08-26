// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PrismaClient, ModuleStatus } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { uploadToS3, getPresignedUrl } from './s3Uploader.js'

const prisma = new PrismaClient()

// Initialize S3 client only if AWS credentials are available
let s3Client: S3Client | null = null
let isS3Enabled = false

try {
  // Use AWS_ prefixed environment variables only
  const awsRegion = process.env.AWS_REGION
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const awsBucketName = process.env.AWS_BUCKET_NAME
  
  console.log('🔍 S3 Configuration Check:')
  console.log('  Region:', awsRegion ? `✅ ${awsRegion}` : '❌ MISSING')
  console.log('  Access Key:', awsAccessKeyId ? `✅ ${awsAccessKeyId.substring(0, 8)}...` : '❌ MISSING')
  console.log('  Secret Key:', awsSecretAccessKey ? `✅ ${awsSecretAccessKey.substring(0, 4)}...` : '❌ MISSING')
  console.log('  Bucket:', awsBucketName ? `✅ ${awsBucketName}` : '❌ MISSING')
  
  // 🧪 ADDITIONAL DEBUG: Show raw environment values
  console.log('🧪 Raw ENV values (startup):')
  console.log({
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : 'MISSING',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? `${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 4)}...` : 'MISSING',
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  })
  
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
      region: !awsRegion ? 'AWS_REGION' : 'OK',
      accessKey: !awsAccessKeyId ? 'AWS_ACCESS_KEY_ID' : 'OK',
      secretKey: !awsSecretAccessKey ? 'AWS_SECRET_ACCESS_KEY' : 'OK',
      bucket: !awsBucketName ? 'AWS_BUCKET_NAME' : 'OK'
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

  // Generate signed URL for reading S3 objects
  async generateSignedUrl(key: string, expiresIn = 900): Promise<string> {
    try {
      if (!this.isS3Enabled() || !s3Client) {
        console.log('📁 S3 not configured, returning local URL for:', key)
        return `http://localhost:8000/uploads/${key}`
      }

      console.log('🔗 Generating S3 signed URL for:', key)
      const bucketName = process.env.AWS_BUCKET_NAME
      if (!bucketName) throw new Error('Missing bucket')

      const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
      const url = await getSignedUrl(s3Client, command, { expiresIn }) // seconds

      console.log('✅ Signed URL generated successfully')
      return url
    } catch (err) {
      console.error('❌ Failed to generate signed URL:', err)
      // Fallback to local URL
      return `http://localhost:8000/uploads/${key}`
    }
  },

  // Get S3 object metadata (HEAD request)
  async headObject(key: string): Promise<any> {
    try {
      if (!this.isS3Enabled() || !s3Client) {
        console.log('📁 S3 not configured, returning mock head for:', key)
        return {
          ContentLength: 1024 * 1024, // 1MB mock
          ContentType: 'video/mp4'
        }
      }

      console.log('🔍 Getting S3 object metadata for:', key)
      const bucketName = process.env.AWS_BUCKET_NAME
      if (!bucketName) throw new Error('Missing bucket')

      const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const command = new HeadObjectCommand({ Bucket: bucketName, Key: key })
      const result = await s3Client.send(command)

      console.log('✅ S3 head successful:', { ContentLength: result.ContentLength, ContentType: result.ContentType })
      return result
    } catch (err) {
      console.error('❌ Failed to get S3 object metadata:', err)
      throw err
    }
  },

  // Get JSON content from S3 object
  async getJson(key: string): Promise<any> {
    try {
      if (!this.isS3Enabled() || !s3Client) {
        console.log('📁 S3 not configured, returning mock JSON for:', key)
        return { steps: [] }
      }

      console.log('📖 Getting JSON from S3 for:', key)
      const bucketName = process.env.AWS_BUCKET_NAME
      if (!bucketName) throw new Error('Missing bucket')

      const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
      const result = await s3Client.send(command)
      
      if (!result.Body) {
        throw new Error('No body in S3 response')
      }

      const bodyContent = await result.Body.transformToString()
      const jsonData = JSON.parse(bodyContent)

      console.log('✅ JSON retrieved successfully from S3:', key)
      return jsonData
    } catch (err) {
      console.error('❌ Failed to get JSON from S3:', err)
      throw err
    }
  },

  // Store JSON content to S3 object
  async putJson(key: string, data: any): Promise<void> {
    try {
      if (!this.isS3Enabled() || !s3Client) {
        console.log('📁 S3 not configured, mock storing JSON for:', key)
        return
      }

      console.log('💾 Storing JSON to S3 for:', key)
      const bucketName = process.env.AWS_BUCKET_NAME
      if (!bucketName) throw new Error('Missing bucket')

      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const jsonString = JSON.stringify(data, null, 2)
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: jsonString,
        ContentType: 'application/json'
      })
      
      await s3Client.send(command)
      console.log('✅ JSON stored successfully to S3:', key)
    } catch (err) {
      console.error('❌ Failed to store JSON to S3:', err)
      throw err
    }
  },

  // Videos go to S3 (unlimited storage) or mock storage
  async uploadVideo(file: Express.Multer.File): Promise<string> {
    try {
      // 🧪 DEBUG: Print environment variables at upload time
      console.log('🧪 Upload debug check — ENV values:')
      console.log({
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING',
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME ? 'SET' : 'MISSING',
        AWS_REGION: process.env.AWS_REGION ? 'SET' : 'MISSING',
      })
      
      // Check what the fallback logic sees
      const fallbackRegion = process.env.AWS_REGION
      const fallbackBucket = process.env.AWS_BUCKET_NAME
      
      console.log('🧪 Fallback values:')
      console.log({
        fallbackRegion,
        fallbackBucket,
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        s3ClientExists: !!s3Client,
        isS3Enabled: isS3Enabled
      })
      
      if (this.isS3Enabled() && s3Client) {
        console.log('🚀 Uploading to S3...')
        const key = `videos/${uuidv4()}-${file.originalname}`
        
        // Use the unified S3 upload helper
        const s3Url = await uploadToS3(file.buffer, key, file.mimetype)
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

  // Upload video with a specific S3 key (for canonical naming)
  async uploadVideoWithKey(file: Express.Multer.File, s3Key: string): Promise<string> {
    try {
      console.log('🚀 Uploading video with specific key:', s3Key)
      
      if (this.isS3Enabled() && s3Client) {
        console.log('🚀 Uploading to S3 with key:', s3Key)
        
        // Use the unified S3 upload helper with the provided key
        const s3Url = await uploadToS3(file.buffer, s3Key, file.mimetype)
        console.log('✅ S3 upload successful with key:', s3Key)
        return s3Url
      } else {
        console.log('📁 Using mock storage (S3 not configured)')
        // Return mock URL for development
        return `http://localhost:8000/uploads/${s3Key.split('/').pop() || file.originalname}`
      }
    } catch (error) {
      console.error('❌ Video upload with key failed:', error instanceof Error ? error.message : 'Unknown error')
      // Fallback to mock storage on S3 failure
      console.log('📁 Falling back to mock storage')
      return `http://localhost:8000/uploads/${s3Key.split('/').pop() || file.originalname}`
    }
  },

  // Metadata goes to Prisma (queryable, relational) or mock storage
  async saveModule(moduleData: any, userId?: string): Promise<string> {
    try {
      if (process.env.DATABASE_URL) {
        console.log('💾 Saving module to database...')
        const module = await prisma.module.create({
          data: {
            id: moduleData.id || uuidv4(),
            title: moduleData.title || 'Untitled Module',
            filename: moduleData.filename || 'video.mp4',
            videoUrl: moduleData.videoUrl,
            s3Key: (moduleData as any).s3Key || '',
            stepsKey: (moduleData as any).stepsKey || `training/${moduleData.id || uuidv4()}.json`,
            status: (moduleData.status as ModuleStatus) || 'UPLOADED',
            progress: moduleData.progress || 0,
            userId: userId || null, // Link to user if authenticated
          } as any,
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
    if (storageService.isS3Enabled() && s3Client) {
      console.log('🔗 Generating S3 signed URL for:', filename)

      const bucketName = process.env.AWS_BUCKET_NAME
      if (!bucketName) throw new Error('Missing bucket')

      // The filename parameter should be the full key (including videos/ prefix and UUID)
      // If it's just the original filename, we need to find the actual S3 key
      let key = filename
      
      // If filename doesn't start with 'videos/', assume it's just the original filename
      if (!filename.startsWith('videos/')) {
        // We need to find the actual S3 key by searching for files with this original name
        // For now, let's assume the frontend will pass the full key
        console.warn('⚠️ getSignedS3Url called with filename that may not include full S3 key:', filename)
        key = `videos/${filename}`
      }

      console.log('🔑 Using S3 key for signed URL:', key)

      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

      const command = new GetObjectCommand({ 
        Bucket: bucketName, 
        Key: key,
      })
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour

      console.log('✅ Signed URL generated successfully')
      return url
    }

    // Fallback to mock/local
    console.log('📁 S3 not configured, returning local URL for:', filename)
    return `http://localhost:8000/uploads/${filename}`
  } catch (err) {
    console.error('❌ Failed to generate signed URL:', err)
    // Fallback to local URL
    return `http://localhost:8000/uploads/${filename}`
  }
} 