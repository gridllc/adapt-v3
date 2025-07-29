// import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
// import { v4 as uuidv4 } from 'uuid'

// const s3Client = new S3Client({
//   region: process.env.S3_REGION || 'us-west-1',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// })

// const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'adaptv3-training-videos'

// Simple ID generator for now
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export const storageService = {
  async uploadVideo(file: Express.Multer.File): Promise<string> {
    // const key = `videos/${uuidv4()}-${file.originalname}`
    
    // const command = new PutObjectCommand({
    //   Bucket: BUCKET_NAME,
    //   Key: key,
    //   Body: file.buffer,
    //   ContentType: file.mimetype,
    // })

    // await s3Client.send(command)
    
    // return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
    return `https://example.com/videos/${generateId()}-${file.originalname}`
  },

  async saveModule(moduleData: any): Promise<string> {
    const moduleId = generateId()
    // const key = `modules/${moduleId}.json`
    
    // const command = new PutObjectCommand({
    //   Bucket: BUCKET_NAME,
    //   Key: key,
    //   Body: JSON.stringify(moduleData),
    //   ContentType: 'application/json',
    // })

    // await s3Client.send(command)
    
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

export async function getSignedS3Url(filename: string): Promise<string> {
  // const command = new GetObjectCommand({
  //   Bucket: BUCKET_NAME,
  //   Key: `videos/${filename}`,
  // })

  // // Generate signed URL that expires in 1 hour
  // const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  // return signedUrl
  return `https://example.com/videos/${filename}?signed=true`
} 