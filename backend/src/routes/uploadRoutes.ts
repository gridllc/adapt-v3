import { Router } from 'express'
import prisma from '../services/prismaService.js'
import { getPresignedUploadUrl } from '../services/presignedUploadService.js'
import { DatabaseService } from '../services/prismaService.js'
import { enqueueProcessModule } from '../services/qstashQueue.js'
import { startProcessing } from '../services/ai/aiPipeline.js'   // 👈 add this
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Configure S3 client for immediate fallback steps
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'adapt-videos';

const router = Router()

// ===== INIT UPLOAD =====
router.post('/init', async (req, res) => {
  try {
    const { filename } = req.body
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Missing filename' })
    }

    const module = await prisma.module.create({
      data: {
        title: filename,
        filename,
        videoUrl: `training/${Date.now()}-${filename}`, // Temporary URL until S3 upload
        status: 'UPLOADED',
        progress: 0,
      },
    })

    const s3Key = `training/${module.id}.mp4`
    const stepsKey = `training/${module.id}.json`
    
    await prisma.module.update({
      where: { id: module.id },
      data: { s3Key, stepsKey },
    })

    const presignedUrl = await getPresignedUploadUrl(s3Key)

    res.json({
      success: true,
      moduleId: module.id,
      presignedUrl,
      key: s3Key,
    })
  } catch (err) {
    console.error('❌ upload/init error:', err)
    res.status(500).json({ success: false, error: 'Failed to init upload' })
  }
})

// ===== COMPLETE UPLOAD =====
router.post('/complete', async (req, res) => {
  try {
    const { moduleId } = req.body
    if (!moduleId) {
      return res.status(400).json({ success: false, error: 'Missing moduleId' })
    }

    console.log(`🚀 [UPLOAD] Starting complete process for moduleId=${moduleId}`)

    // Mark PROCESSING
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0)

    // --- ✅ Fallback: immediately create dummy steps file ---
    const steps = [
      { start: 0, end: 3, text: "Intro" },
      { start: 3, end: 7, text: "Main content" },
      { start: 7, end: 10, text: "Wrap-up" }
    ]

    const stepsKey = `training/${moduleId}.json`
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: stepsKey,
      Body: JSON.stringify(steps, null, 2),
      ContentType: 'application/json',
    });
    await s3Client.send(command);

    // Mark READY so frontend can load something
    await prisma.module.update({
      where: { id: moduleId },
      data: {
        stepsKey,
        status: 'READY',
        progress: 100,
      },
    })

    console.log(`✅ [UPLOAD] Module ${moduleId} marked READY with fallback steps`)

    // Kick off async AI processing (can overwrite later)
    const jobId = await enqueueProcessModule(moduleId)

    console.log(`✅ [UPLOAD] Complete process finished successfully for moduleId=${moduleId}`)
    res.json({ success: true, moduleId, jobId })
  } catch (err) {
    console.error(`❌ [UPLOAD] upload/complete error for moduleId=${req.body.moduleId}:`, err)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
})

export default router