import { Router } from 'express'
import prisma from '../services/prismaService.js'
import { getPresignedUploadUrl } from '../services/presignedUploadService.js'
import { DatabaseService } from '../services/prismaService.js'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { enqueueProcessModule } from '../services/qstashQueue.js'

const router = Router()
const USE_QSTASH = process.env.USE_QSTASH === 'true'   // toggle inline vs async

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

    // Mark status PROCESSING
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0)
    console.log(`✅ [UPLOAD] Module status updated to PROCESSING for moduleId=${moduleId}`)

    if (USE_QSTASH) {
      // enqueue async job
      console.log(`📬 [UPLOAD] QStash enabled, enqueueing job for moduleId=${moduleId}`)
      const jobId = await enqueueProcessModule(moduleId)
      console.log('📬 [UPLOAD] Enqueued processing job', { moduleId, jobId })
    } else {
      // run inline for testing/dev
      console.log(`⚙️ [UPLOAD] QStash disabled, running inline processing for moduleId=${moduleId}`)
      await startProcessing(moduleId)
      console.log(`✅ [UPLOAD] Inline processing completed for moduleId=${moduleId}`)
    }

    console.log(`✅ [UPLOAD] Complete process finished successfully for moduleId=${moduleId}`)
    res.json({ success: true, moduleId })
  } catch (err) {
    console.error(`❌ [UPLOAD] upload/complete error for moduleId=${req.body.moduleId}:`, err)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
})

export default router