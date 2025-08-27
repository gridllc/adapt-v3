import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos'

export const presignedUploadService = {
  async generatePresignedUrl(filename: string, contentType: string, moduleId: string) {
    // Single source of truth for key shape - matches the expected training/ structure
    const key = `training/${moduleId}/${randomUUID()}-${filename}`
    
    console.log(`[UPLOAD] presign (moduleId: ${moduleId}, key: ${key})`)
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType, // Critical: must match the PUT request ContentType
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 60 * 5 // 5 minutes - shorter for security
    })

    return {
      uploadUrl: presignedUrl, // Return as uploadUrl for consistency
      key,
      moduleId
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
