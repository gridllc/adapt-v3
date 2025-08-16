// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuid } from "uuid"

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET!

/**
 * Generate a signed URL for uploading a file directly to S3
 */
export async function getSignedPutUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return await getSignedUrl(s3, command, { expiresIn: 60 * 5 }) // 5 min expiry
}

/**
 * Generate a signed URL for reading a file from S3
 */
export async function getSignedGetUrl(key: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  return await getSignedUrl(s3, command, { expiresIn: 60 * 5 })
}

/**
 * Generate a unique key for a new upload
 */
export function generateVideoKey(filename: string): string {
  const safeName = filename.replace(/\s+/g, "-").toLowerCase()
  return `videos/${uuid()}-${safeName}`
}
