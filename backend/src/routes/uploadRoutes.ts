import { Router } from 'express'
import prisma from '../services/prismaService.js'
import { getPresignedUploadUrl } from '../services/presignedUploadService.js'
import { DatabaseService } from '../services/prismaService.js'
import { queueOrInline } from '../services/qstashQueue.js'

const router = Router()

// ===== INIT UPLOAD =====
router.post('/init', async (req, res) => {
  try {
    const { filename } = req.body
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Missing filename' })
    }

    // 1. Create module row in DB
    const module = await prisma.module.create({
      data: {
        title: filename,
        filename,
        videoUrl: `training/${Date.now()}-${filename}`, // Temporary URL until S3 upload
        status: 'UPLOADED',
        progress: 0,
      },
    })

    // 2. Use moduleId as the S3 key
    const s3Key = `training/${module.id}.mp4`

    // 3. Save the s3Key back to DB
    await prisma.module.update({
      where: { id: module.id },
      data: { s3Key },
    })

    // 4. Generate presigned URL
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

    // Update status → PROCESSING
    await DatabaseService.updateModuleStatus(moduleId, 'PROCESSING', 0)

    // Enqueue QStash job or process inline
    try {
      const jobId = await queueOrInline(moduleId)
      console.log(`📬 Enqueued processing job moduleId=${moduleId}, jobId=${jobId}`)
    } catch (processingError) {
      console.error('Failed to enqueue processing:', processingError)
      // Continue anyway - the video is uploaded
    }

    res.json({ success: true, moduleId })
  } catch (err) {
    console.error('❌ upload/complete error:', err)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
})

export default router