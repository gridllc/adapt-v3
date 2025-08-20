import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REGION = process.env.AWS_REGION!
const BUCKET = process.env.AWS_BUCKET_NAME!

// If you need to pass creds explicitly, the SDK will also pick up AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
const s3 = new S3Client({ region: REGION })

export const presignedUploadService = {
  async presignPut({ key, contentType }: { key: string; contentType: string }) {
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
    return { url }
  },

  async confirmHead(key: string): Promise<boolean> {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
      return true
    } catch {
      return false
    }
  },

  // Backward compatibility method
  async getSignedPlaybackUrl(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
    return getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
  }
}
