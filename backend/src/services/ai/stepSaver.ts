import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION! })
const bucket = process.env.AWS_BUCKET_NAME!

export const stepSaver = {
  async saveToS3(stepsKey: string, payload: any) {
    const Body = Buffer.from(JSON.stringify(payload, null, 2), 'utf8')
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: stepsKey,
      Body,
      ContentType: 'application/json',
    }))
    console.log('✅ Steps saved to S3:', stepsKey)
  },
}
