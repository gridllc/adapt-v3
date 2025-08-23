import { Router } from 'express'
import { optionalAuth } from '../middleware/auth.js'
import { ModuleService } from '../services/moduleService.js'
import { storageService } from '../services/storageService.js'
import { log } from '../utils/logger.js'
import type { Request, Response } from 'express'

const router = Router()

/**
 * GET /api/video/:moduleId/play
 * Returns a short-lived signed S3 URL for the module's video.
 */
router.get('/:moduleId/play', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    log.info('🎬 Generating play URL for module', { moduleId })
    
    const mod = await ModuleService.get(moduleId)

    if (!mod) {
      log.warn('❌ Module not found', { moduleId })
      return res.status(404).json({ success: false, error: 'Module not found' })
    }
    
    if (mod.status !== 'READY') {
      log.warn('❌ Module not READY', { moduleId, status: mod.status })
      return res.status(409).json({ success: false, error: `Module not READY (status=${mod.status})` })
    }
    
    // Prefer canonical s3Key; fall back to parsing from any stored videoUrl if present.
    const s3Key: string | undefined = mod.s3Key ?? undefined
    if (!s3Key) {
      log.warn('❌ No S3 key recorded for this module', { moduleId })
      return res.status(422).json({ success: false, error: 'No S3 key recorded for this module' })
    }

    // 10-minute URL; tweak as needed.
    const url = await storageService.getSignedPlaybackUrl(s3Key, 60 * 10)

    // Prevent caching of the JSON response (the URL itself will have its own expiry).
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    
    log.info('✅ Generated play URL successfully', { moduleId, expiresIn: '10 minutes' })
    return res.json({ success: true, url })
  } catch (err: any) {
    log.error('❌ Failed to sign playback URL', { moduleId: req.params.moduleId, error: err?.message })
    return res.status(500).json({ success: false, error: 'Failed to sign playback URL' })
  }
})

export { router as videoRoutes }