import { Router } from 'express'
import prisma from '../services/prismaService'
import { getPresignedUploadUrl } from '../services/presignedUploadService'

const router = Router()

// 1) Init Upload → create DB row + presign URL
router.post('/init', async (req, res) => {
  try {
    const { filename } = req.body
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Missing filename' })
    }

    // Create DB row with required fields
    const module = await prisma.module.create({
      data: {
        title: filename,
        filename: filename,
        videoUrl: `training/${Date.now()}-${filename}`, // Temporary URL until S3 upload
        status: 'UPLOADED',
        s3Key: `training/${Date.now()}-${filename}`,
      },
    })

    // Generate presigned PUT URL
    const presignedUrl = await getPresignedUploadUrl(module.s3Key!)

    res.json({
      success: true,
      moduleId: module.id,
      presignedUrl,
      key: module.s3Key,
    })
  } catch (err) {
    console.error('❌ upload/init error:', err)
    res.status(500).json({ success: false, error: 'Failed to init upload' })
  }
})

// 2) Complete Upload → mark DB status
router.post('/complete', async (req, res) => {
  try {
    const { moduleId } = req.body
    if (!moduleId) {
      return res.status(400).json({ success: false, error: 'Missing moduleId' })
    }

    await prisma.module.update({
      where: { id: moduleId },
      data: { status: 'PROCESSING', progress: 0 },
    })

    res.json({ success: true, moduleId })
  } catch (err) {
    console.error('❌ upload/complete error:', err)
    res.status(500).json({ success: false, error: 'Failed to complete upload' })
  }
})

export default router