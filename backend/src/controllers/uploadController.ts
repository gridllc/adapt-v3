// backend/src/controllers/uploadController.ts
import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { ModuleService } from '../services/moduleService.js'
import { storageService } from '../services/storageService.js'
import { startProcessing } from '../services/ai/aiPipeline.js'
import { enqueueProcessModule, isEnabled } from '../services/qstashQueue.js'
import { log } from '../utils/logger.js'

// Decide between QStash enqueue or inline processing
async function queueOrInline(moduleId: string) {
  try {
    if (isEnabled()) {
      const jobId = await enqueueProcessModule(moduleId)
      log.info('📬 Enqueued processing job', { moduleId, jobId })
    } else {
      log.info('⚙️ QStash disabled, running inline processing', { moduleId })
      await startProcessing(moduleId)
    }
  } catch (err: any) {
    if (err?.message === 'QSTASH_DISABLED') {
      log.warn('📬 QStash disabled, falling back to inline processing', { moduleId })
      await startProcessing(moduleId)
    } else {
      log.error('Processing error', err)
      throw err
    }
  }
}

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    try {
      if (!req.file) {
        log.error('❌ No file in request')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      log.info('📦 File received', {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      })

      // Validate file type
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      if (file.size < 1000) {
        return res.status(400).json({ error: 'File too small, likely corrupted' })
      }

      if (file.size > 500 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large (>500MB)' })
      }

      if (!file.buffer || file.buffer.length !== file.size) {
        return res.status(400).json({ error: 'File buffer invalid or size mismatch' })
      }

      // Generate IDs and keys
      const moduleId = uuidv4()
      const s3Key = `videos/${moduleId}.mp4`
      const stepsKey = `training/${moduleId}.json`

      log.info('🔑 Generated canonical keys', { moduleId, s3Key, stepsKey })

      // Upload to S3
      const videoUrl = await storageService.uploadVideoWithKey(file, s3Key)
      log.info('✅ Video uploaded', { videoUrl })

      // Save module record
      const userId = (req as any).userId
      const moduleData = {
        id: moduleId,
        title: file.originalname.replace(/\.[^/.]+$/, ''),
        filename: file.originalname,
        videoUrl,
        s3Key,
        stepsKey,
        status: 'UPLOADED' as const
      }

      const savedModuleId = await storageService.saveModule(moduleData, userId)
      log.info('✅ Module saved', { savedModuleId, userId })

      // Respond immediately
      res.json({
        success: true,
        moduleId: savedModuleId,
        videoUrl: s3Key,
        status: 'uploaded',
        steps: [],
        message: 'Video uploaded successfully. AI processing will start shortly...'
      })

      // Trigger background processing (fire-and-forget)
      queueMicrotask(async () => {
        try {
          await queueOrInline(savedModuleId)
        } catch (err) {
          log.error('❌ Failed to enqueue or process module', { moduleId: savedModuleId, err })
        }
      })
    } catch (error: any) {
      log.error('💥 Upload controller error', error)
      res.status(500).json({
        error: 'Upload failed',
        message: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }
}
