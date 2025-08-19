import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  endpoint: 'https://s3.us-west-1.amazonaws.com', // ✅ avoid redirect - force us-west-1
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos'

export const presignedUploadService = {
  async generatePresignedUrl(filename: string, contentType: string, customKey?: string) {
    const key = customKey || `videos/${uuidv4()}-${filename}`
    
    // Force video/mp4 MIME type for all video uploads to ensure browser compatibility
    const videoContentType = contentType.startsWith('video/') ? 'video/mp4' : contentType
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: videoContentType,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 
    })

    return {
      presignedUrl,
      key,
      fileUrl: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${key}`
    }
  },

  async confirmUpload(key: string) {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      })

      await s3Client.send(command)
      
      return {
        success: true,
        fileUrl: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${key}`
      }
    } catch (error) {
      console.error('Failed to confirm upload:', error)
      return {
        success: false,
        error: 'File not found in S3'
      }
    }
  }
}
