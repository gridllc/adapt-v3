import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = process.env.S3_BUCKET_NAME!

/**
 * Get S3 client with validation
 */
function getS3Client(): S3Client {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured')
  }

  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
  })
}

// Create a single shared S3 client instance (only if configured)
let s3Client: S3Client | null = null

// Initialize client when needed
function getSharedS3Client(): S3Client {
  if (!s3Client) {
    s3Client = getS3Client()
  }
  return s3Client
}

// Export the shared client getter for reuse
export { getSharedS3Client as s3Client }

/**
 * Validate S3 configuration at startup
 */
export function validateS3Config(): void {
  if (process.env.NODE_ENV === 'production' && !isS3Configured()) {
    throw new Error('❌ S3 is not configured in production mode')
  }
  
  if (isS3Configured()) {
    console.log('[TEST] ✅ S3 configuration validated')
    console.log(`[TEST] 📦 S3 Bucket: ${BUCKET_NAME}`)
    console.log(`[TEST] 🌍 S3 Region: ${process.env.S3_REGION || 'us-east-1'}`)
  } else {
    console.log('[TEST] ⚠️ S3 not configured - using local fallback')
  }
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
  try {
    console.log(`[TEST] 📁 Uploading to S3: ${filename}`)
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
      ACL: 'public-read'
    })

    await getSharedS3Client().send(command)
    
    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${filename}`
    console.log(`[TEST] ✅ S3 upload successful: ${s3Url}`)
    
    return s3Url
  } catch (error) {
    console.error('[TEST] ❌ S3 upload failed:', error)
    throw new Error(`Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(filename: string): Promise<boolean> {
  try {
    console.log(`[TEST] 🗑️ Deleting from S3: ${filename}`)
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename
    })

    await getSharedS3Client().send(command)
    
    console.log(`[TEST] ✅ S3 deletion successful: ${filename}`)
    return true
  } catch (error) {
    console.error('[TEST] ❌ S3 deletion failed:', error)
    return false
  }
}

/**
 * Get a presigned URL for file access
 */
export async function getPresignedUrl(filename: string, expiresIn: number = 3600): Promise<string> {
  try {
    console.log(`[TEST] 🔗 Generating presigned URL for: ${filename}`)
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename
    })

    const presignedUrl = await getSignedUrl(getSharedS3Client(), command, { expiresIn })
    
    console.log(`[TEST] ✅ Presigned URL generated: ${presignedUrl.substring(0, 50)}...`)
    return presignedUrl
  } catch (error) {
    console.error('[TEST] ❌ Failed to generate presigned URL:', error)
    throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME)
}

/**
 * Get the public S3 URL for a file
 */
export function getPublicS3Url(filename: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${filename}`
} 