// routes/storageRoutes.ts
import { Router } from 'express'
import prisma from '../services/prismaService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'

const router = Router()

// Playback: GET /video/:moduleId/play
router.get('/video/:moduleId/play', async (req, res) => {
  try {
    const { moduleId } = req.params
    if (!moduleId) {
      return res.status(400).json({ success: false, error: 'Missing moduleId' })
    }

    // Look up module in DB
    const module = await prisma.module.findUnique({ where: { id: moduleId } })
    if (!module || !module.s3Key) {
      return res.status(404).json({ success: false, error: 'Module not found' })
    }

    // Generate a short-lived signed URL for playback
    const signedUrl = await presignedUploadService.getSignedPlaybackUrl(module.s3Key)

    res.json({ success: true, url: signedUrl })
  } catch (err) {
    console.error('❌ storageRoutes error:', err)
    res.status(500).json({ success: false, error: 'Failed to get playback URL' })
  }
})

export default router
