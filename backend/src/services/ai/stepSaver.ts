import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { normalizeSteps, RawStep } from './stepProcessor.js'

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
    // Build raw steps from AI and attach times from segments when missing
    const transcriptSegments = meta.segments || [];
    const rawSteps: RawStep[] = steps.map((s, i) => ({
      title: s.title,
      description: s.description,
      start: s.start ?? transcriptSegments[i]?.start, // use Whisper/AssemblyAI segment time
      end:   s.end   ?? transcriptSegments[i]?.end,
    }));

    // Normalize & clamp to video length
    const finalSteps = normalizeSteps(rawSteps, meta.durationSec || 60);

    const body = JSON.stringify({
      version: 3,
      moduleId,
      createdAt: new Date().toISOString(),
      transcript,                        // Ensure transcript is always present
      steps: finalSteps,
      meta
    });

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: Buffer.from(body, 'utf8'),
      ContentType: 'application/json',
    }));

    console.log('✅ Steps + transcript saved to S3:', s3Key, `(${finalSteps.length} steps, ${transcript.length} chars)`)
  },
}
