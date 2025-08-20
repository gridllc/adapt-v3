import { Router } from 'express'
import prisma from '../services/prismaService.js'
import { getPresignedUploadUrl } from '../services/presignedUploadService.js'
import { DatabaseService } from '../services/prismaService.js'
import { enqueueProcessModule } from '../services/qstashQueue.js'
import { startProcessing } from '../services/ai/aiPipeline.js'  // add this

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

    // Mark status PROCESSING
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0)
    console.log(`✅ [UPLOAD] Module status updated to PROCESSING for moduleId=${moduleId}`)

    let jobId: string | null = null

    if (process.env.USE_QSTASH === 'true') {
      const result = await enqueueProcessModule(moduleId)
      jobId = result || null
      console.log(`📬 [UPLOAD] QStash job enqueued for moduleId=${moduleId}, jobId=${jobId}`)
    } else {
      console.log(`⚙️ [UPLOAD] Running inline processing for moduleId=${moduleId}`)
      await startProcessing(moduleId)   // 👈 this was missing
      console.log(`✅ [UPLOAD] Inline processing completed for moduleId=${moduleId}`)
    }

    console.log(`✅ [UPLOAD] Complete process finished successfully for moduleId=${moduleId}`)
    res.json({ success: true, moduleId, jobId })
  } catch (err) {
    console.error(`❌ [UPLOAD] upload/complete error for moduleId=${req.body.moduleId}:`, err)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
})

export default router