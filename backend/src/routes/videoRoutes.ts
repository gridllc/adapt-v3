import express, { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { getSignedS3Url } from '../services/storageService.js'

const router = express.Router()

const paramSchema = z.object({
  filename: z.string().min(5).max(200),
})

router.get('/video-url/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = paramSchema.parse(req.params)
    const signedUrl = await getSignedS3Url(filename)
    return res.status(200).json({
      success: true,
      url: signedUrl,
    })
  } catch (error: any) {
    console.error('Signed URL error:', error)
    // Distinguish between validation and server errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid filename' })
    }
    return res.status(500).json({ error: 'URL generation failed' })
  }
})

export default router