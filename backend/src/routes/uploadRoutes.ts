import { Router } from 'express'
import prisma from '../services/prismaService.js'
import { getPresignedUploadUrl } from '../services/presignedUploadService.js'
import { DatabaseService } from '../services/prismaService.js'
import { enqueueProcessModule } from '../services/qstashQueue.js'
import { startProcessing } from '../services/ai/aiPipeline.js'   // 👈 add this
import { storageService } from '../services/storageService.js'

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

    // Mark PROCESSING first
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0)

    // --- ✅ Immediately create dummy steps ---
    const dummySteps = [
      { start: 0, end: 2, text: "Preparing training content..." }
    ]
    const stepsKey = `training/${moduleId}.json`

    // Save dummy steps to S3
    await storageService.putObject(stepsKey, JSON.stringify(dummySteps, null, 2))

    // Flip module to READY
    await prisma.module.update({
      where: { id: moduleId },
      data: {
        stepsKey,
        status: 'READY',
        progress: 100,
      },
    })

    console.log(`✅ [UPLOAD] Module ${moduleId} marked READY with fallback steps`)

    // Kick off AI processing async (can overwrite dummy later)
    const jobId = await enqueueProcessModule(moduleId)

    res.json({ success: true, moduleId, jobId })
  } catch (err) {
    console.error(`❌ [UPLOAD] upload/complete error for moduleId=${req.body.moduleId}:`, err)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
})

export default router