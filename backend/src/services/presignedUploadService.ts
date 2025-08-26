import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
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

export const presignedUploadService = {
  async generatePresignedUrl(filename: string, contentType: string) {
    const key = `videos/${uuidv4()}-${filename}`
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 
    })

    return {
      presignedUrl,
      key,
      fileUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
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
        fileUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
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
