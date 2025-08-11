import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET_NAME = (process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET)!

/**
 * Get S3 client with validation
 */
function getS3Client(): S3Client {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured')
  }

  return new S3Client({
    region: process.env.AWS_REGION || 'us-west-1',
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
  if (!isS3Configured()) {
    throw new Error('❌ S3 storage is required but not configured. Please check AWS environment variables.')
  }
  
  console.log('[TEST] ✅ S3 configuration validated')
  console.log(`[TEST] 📦 S3 Bucket: ${BUCKET_NAME}`)
  console.log(`[TEST] 🌍 S3 Region: ${process.env.AWS_REGION || 'us-west-1'}`)
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
      ACL: 'bucket-owner-full-control'
    })

    await getSharedS3Client().send(command)
    
    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${filename}`
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
    console.log(`[TEST] 🗑️ Deleting S3 object: ${filename}`)
    
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
 * Get a presigned URL for file access (GET)
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
 * Get a presigned URL for uploading (PUT)
 */
export async function getUploadPresignedUrl(filename: string, contentType: string, expiresIn: number = 900): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
    })

    const presignedUrl = await getSignedUrl(getSharedS3Client(), command, { expiresIn })
    return presignedUrl
  } catch (error) {
    console.error('[TEST] ❌ Failed to generate upload presigned URL:', error)
    throw new Error(`Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}



/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME)
}

/**
 * Get the public S3 URL for a file
 */
export function getPublicS3Url(filename: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${filename}`
} 