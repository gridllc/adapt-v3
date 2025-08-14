import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: process.env.AWS_REGION! })
const bucket = process.env.AWS_BUCKET_NAME!

export const stepSaver = {
  async saveToS3(stepsKey: string, payload: any) {
    const Body = Buffer.from(JSON.stringify(payload, null, 2), 'utf8')
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: bucket,
      Body,
      ContentType: 'application/json',
    }))
    console.log('✅ Steps saved to S3:', stepsKey)
  },

  async saveStepsToS3({
    moduleId,
    s3Key,
    steps,
    transcript,
    meta = {}
  }: {
    moduleId: string;
    s3Key: string;
    steps: any[];
    transcript: string;
    meta?: Record<string, any>;
  }) {
    const body = JSON.stringify({
      version: 3,
      moduleId,
      createdAt: new Date().toISOString(),
      transcript,                        // Ensure transcript is always present
      steps,
      meta
    });

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: Buffer.from(body, 'utf8'),
      ContentType: 'application/json',
    }));
    
    console.log('✅ Steps + transcript saved to S3:', s3Key, `(${steps.length} steps, ${transcript.length} chars)`)
  },
}
