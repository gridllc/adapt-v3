import prisma, { DatabaseService } from '../prismaService.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos';

export async function startProcessing(moduleId: string) {
  console.log(`⚙️ [PIPELINE] Starting processing for moduleId=${moduleId}`)
  try {
    // --- STEP 1: Update DB to PROCESSING
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0)

    // --- STEP 2: (TODO) Run transcription + AI step generation
    // For now, we simulate steps so frontend can load.
    const steps = [
      { start: 0, end: 5, text: "Intro" },
      { start: 5, end: 10, text: "Main section" },
      { start: 10, end: 15, text: "Closing" },
    ]

    // --- STEP 3: Upload steps JSON to S3
    const stepsKey = `training/${moduleId}.json`
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: stepsKey,
      Body: JSON.stringify(steps, null, 2),
      ContentType: 'application/json',
    });
    await s3Client.send(command);
    console.log(`✅ [PIPELINE] Uploaded steps to S3 at ${stepsKey}`)

    // --- STEP 4: Update DB to READY
    await prisma.module.update({
      where: { id: moduleId },
      data: {
        stepsKey,
        status: 'READY',
        progress: 100,
      },
    })
    console.log(`✅ [PIPELINE] Module marked READY for ${moduleId}`)
  } catch (err) {
    console.error(`❌ [PIPELINE] Error processing module ${moduleId}:`, err)

    // --- STEP 5: Ensure FAILED status if error
    await DatabaseService.updateModuleStatus(moduleId, 'FAILED', 0)
  }
}
