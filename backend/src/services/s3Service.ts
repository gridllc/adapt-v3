import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,             // e.g. "us-west-1"
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})
const BUCKET = process.env.AWS_BUCKET_NAME!    // e.g. "adaptv3-training-videos"

export async function getSignedUrlForKey(key: string, expiresSec = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return await getSignedUrl(s3, cmd, { expiresIn: expiresSec })
}

export const s3Service = { getSignedUrl: getSignedUrlForKey } 