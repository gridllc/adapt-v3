import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { normalizeSteps, RawStep } from './stepProcessor.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

  async clearOldPlaceholders(moduleId: string) {
    // Prisma: clear old steps for this module
    await prisma.step.deleteMany({ where: { moduleId } });
    console.log(`🧹 Cleared old placeholders for ${moduleId}`);
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
    // Clear any old placeholders first
    await this.clearOldPlaceholders(moduleId);

    // Build raw steps from AI and attach times from segments when missing
    const transcriptSegments = meta.segments || [];
    const rawSteps: RawStep[] = steps.map((s, i) => ({
      title: s.title,
      description: s.description,
      start: s.start ?? transcriptSegments[i]?.start, // use Whisper/AssemblyAI segment time
      end:   s.end   ?? transcriptSegments[i]?.end,
    }));

    // meta.durationSec MUST be the true video length
    const finalSteps = normalizeSteps(rawSteps, meta.durationSec);

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
