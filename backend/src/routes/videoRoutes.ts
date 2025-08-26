import express, { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { getSignedS3Url } from '../services/storageService.js'
import { videoController } from '../controllers/videoController.js'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const router = express.Router()
const prisma = new PrismaClient()

// Initialize S3 client for the new endpoint
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const paramSchema = z.object({
  filename: z.string().min(5).max(200),
})

/**
 * NEW: sign playback URL by moduleId (uses the exact s3Key saved on the module)
 */
router.get("/by-module/:moduleId", async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;

    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { s3Key: true, videoContentType: true, videoUrl: true },
    });

    if (!module) return res.status(404).json({ success: false, error: "Module not found" });

    // Prefer s3Key; fall back to parsing from videoUrl if needed
    let key = module.s3Key;
    if (!key && module.videoUrl) {
      const idx = module.videoUrl.indexOf(".amazonaws.com/");
      if (idx !== -1) key = module.videoUrl.slice(idx + ".amazonaws.com/".length);
    }
    if (!key) return res.status(404).json({ success: false, error: "No S3 key on module" });

    // Sign with an explicit content type (Android is picky)
    const cmd = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      ResponseContentType: module.videoContentType || "video/mp4",
      ResponseCacheControl: "public, max-age=60",
    });

    const url = await getSignedUrl(s3Client, cmd, { expiresIn: 60 * 10 });
    return res.json({ success: true, url });
  } catch (err: any) {
    console.error("sign by-module error:", err);
    return res.status(500).json({ success: false, error: err.message || "internal error" });
  }
});

// Handle CORS preflight requests for video files
router.options('/:filename', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range')
  res.status(200).end()
})

// Get signed URL for video (API endpoint)
router.get('/url/:filename', async (req: Request, res: Response, next: NextFunction) => {
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

// Serve video files directly with proper headers
router.get('/:filename', videoController.serveVideo)

export default router