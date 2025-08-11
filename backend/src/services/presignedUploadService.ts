import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import config from '../config/env.js'

const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET_NAME = config.AWS_BUCKET_NAME

export const presignedUploadService = {
  /**
   * Generate presigned URL for direct S3 upload
   */
  async generatePresignedUrl(filename: string, contentType: string) {
    // Generate unique key with timestamp to avoid conflicts
    const timestamp = Date.now()
    const key = `videos/${timestamp}-${uuidv4()}-${filename}`
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // Add metadata for tracking
      Metadata: {
        'uploaded-by': 'adapt-app',
        'upload-timestamp': timestamp.toString(),
        'original-filename': filename
      }
    })

    // Generate presigned URL (expires in 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 
    })

    return {
      presignedUrl,
      key,
      fileUrl: `https://${BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`
    }
  },

  /**
   * Confirm upload completion by checking if file exists in S3
   */
  async confirmUpload(key: string) {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      })

      await s3Client.send(command)
      
      return {
        success: true,
        fileUrl: `https://${BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`
      }
    } catch (error) {
      console.error('Failed to confirm upload:', error)
      return {
        success: false,
        error: 'File not found in S3'
      }
    }
  },

  /**
   * Get public S3 URL for a file
   */
  getPublicUrl(key: string): string {
    return `https://${BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`
  }
}
