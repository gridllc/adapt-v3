import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3Client, isS3Configured } from './s3Uploader.js'

// Export the shared client for compatibility
export { s3Client as s3 }

// Health check function
export async function checkS3Health(): Promise<boolean> {
  try {
    if (!isS3Configured() || !process.env.AWS_BUCKET_NAME) {
      console.log('[TEST] Cloud storage not configured - skipping health check')
      return false
    }

    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET_NAME,
      MaxKeys: 1
    })

    await s3Client().send(command)
    
    console.log(`[TEST] ✅ Cloud storage health check passed: ${process.env.AWS_BUCKET_NAME}`)
    return true
  } catch (error) {
    console.error('[TEST] Cloud storage health check failed:', error)
    return false
  }
} 
