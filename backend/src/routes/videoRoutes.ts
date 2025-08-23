import { Router, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { s3Service } from '../services/s3Service.js'
import { mustBeAuthed, currentUserId } from '../middleware/auth.js'

export const videoRoutes = Router()

/**
 * GET /api/video/:moduleId/play
 * Dedicated endpoint to get a signed video URL for playback
 */
videoRoutes.get('/:moduleId/play', mustBeAuthed, async (req: Request, res: Response) => {
  const moduleId = req.params.moduleId
  
  // ✅ CRITICAL: Guard against placeholder IDs
  if (/^<.*>$/.test(moduleId)) {
    return res.status(400).json({ success: false, error: 'Placeholder module id' });
  }
  
  try {
    const userId = currentUserId(req)
    
    // Get module and verify ownership
    const mod = await prisma.module.findUnique({ 
      where: { id: moduleId },
      select: { id: true, status: true, s3Key: true, userId: true }
    })
    
    if (!mod) {
      return res.status(404).json({ success: false, error: 'Module not found' })
    }
    
    if (mod.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    
    if (mod.status !== 'READY') {
      return res.status(400).json({ success: false, error: 'Module not ready' })
    }
    
    if (!mod.s3Key) {
      return res.status(400).json({ success: false, error: 'No video file found' })
    }
    
    // Generate signed URL
    const url = await s3Service.getSignedUrl(mod.s3Key, 3600) // 1 hour
    
    res.json({ success: true, url })
    
  } catch (error: any) {
    console.error('Video play endpoint error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate video URL' })
  }
})