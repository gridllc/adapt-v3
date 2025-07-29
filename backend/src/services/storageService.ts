import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'adapt-videos'

export const storageService = {
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
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(moduleData),
      ContentType: 'application/json',
    })

    await s3Client.send(command)
    
    return moduleId
  },

  async getModule(moduleId: string): Promise<any> {
    // This would typically fetch from S3 or database
    // For now, return mock data
    return {
      id: moduleId,
      title: 'Sample Training Module',
      description: 'A sample training module',
      videoUrl: 'https://example.com/video.mp4',
      steps: [
        {
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome to the training',
          duration: 30,
        },
      ],
    }
  },

  async getAllModules(): Promise<any[]> {
    // This would typically fetch from S3 or database
    // For now, return mock data
    return [
      {
        id: '1',
        title: 'Coffee Maker Training',
        description: 'Learn how to use your coffee maker',
        videoUrl: 'https://example.com/coffee.mp4',
      },
      {
        id: '2',
        title: 'Fire TV Remote',
        description: 'Master your Fire TV remote controls',
        videoUrl: 'https://example.com/firetv.mp4',
      },
    ]
  },
} 