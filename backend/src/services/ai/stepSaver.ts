import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3 = new S3Client({ 
  region: process.env.AWS_REGION || 'us-west-1',
  endpoint: 'https://s3.us-west-1.amazonaws.com' // ✅ avoid redirect - force us-west-1
})
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
    // Debug: Log what we're saving
    console.log('🔍 [StepSaver] About to save to S3:', {
      moduleId,
      s3Key,
      stepCount: steps?.length || 0,
      stepsType: typeof steps,
      isArray: Array.isArray(steps),
      firstStep: steps?.[0],
      lastStep: steps?.[steps?.length - 1]
    })
    
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
    
    console.log('✅ Steps + transcript saved to S3:', s3Key, `(${steps?.length || 0} steps, ${transcript.length} chars)`)
  },
}
