// backend/src/services/storageService.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { logger } from "../../frontend/src/utils/logger" // adjust path if needed
import fs from "fs"
import path from "path"

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_BUCKET_NAME!

export const storageService = {
  async uploadFile(key: string, filePath: string, contentType: string) {
    try {
      const fileStream = fs.createReadStream(filePath)
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
      }))
      logger.info(`Uploaded file to S3: ${key}`)
    } catch (err) {
      logger.error("S3 upload failed:", err)
      throw err
    }
  },

  async downloadFile(key: string, destPath: string) {
    try {
      const data = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
      const stream = data.Body as NodeJS.ReadableStream
      const writeStream = fs.createWriteStream(destPath)
      stream.pipe(writeStream)
      logger.info(`Downloaded file from S3: ${key}`)
    } catch (err) {
      logger.error("S3 download failed:", err)
      throw err
    }
  },

  async deleteFile(key: string) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
      logger.info(`Deleted file from S3: ${key}`)
    } catch (err) {
      logger.error("S3 delete failed:", err)
      throw err
    }
  },

  async getSignedUrl(key: string, expiresInSeconds = 3600) {
    try {
      const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
      const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
      logger.debug("Generated signed URL", url)
      return url
    } catch (err) {
      logger.error("S3 signed URL generation failed:", err)
      throw err
    }
  },
}
