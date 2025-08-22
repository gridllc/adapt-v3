// backend/src/routes/webhookRoutes.ts
import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import { prisma } from "../config/database.js";
import { logger } from "../utils/structuredLogger.js";
import { ModuleService } from "../services/moduleService.js";

const router = Router();

/**
 * AssemblyAI webhook endpoint
 * Called with: POST /webhooks/assemblyai?moduleId=...&token=...
 * Body example: { "id": "<aai_transcript_id>", "status": "completed" | "error" | "processing", ... }
 */
router.post('/assemblyai', async (req: Request, res: Response) => {
  // 1) Validate query params & token
  const moduleId = String(req.query.moduleId ?? '')
  const token = String(req.query.token ?? '')
  const expected = process.env.ASSEMBLYAI_WEBHOOK_SECRET
  const headerToken = String(req.headers['x-aai-webhook'] ?? '')

  if (!moduleId) {
    logger.warn('❌ [WEBHOOK] Missing moduleId')
    return res.status(400).send('missing moduleId')
  }
  if (!expected) {
    logger.error('❌ [WEBHOOK] Missing ASSEMBLYAI_WEBHOOK_SECRET env')
    return res.status(500).send('server not configured')
  }
  if (token !== expected && headerToken !== expected) {
    logger.warn('❌ [WEBHOOK] Invalid token', { moduleId })
    return res.status(403).send('invalid token')
  }

  const payload = req.body || {}
  const aaiId: string | undefined = payload?.id || payload?.transcript_id || payload?.transcriptId
  const aaiStatus: string | undefined = payload?.status

  logger.info('🎣 [WEBHOOK] AAI webhook received', { 
    moduleId, 
    aaiId, 
    aaiStatus, 
    payloadKeys: Object.keys(payload),
    payload: JSON.stringify(payload, null, 2)
  })

  // Acknowledge early so AAI doesn't retry due to timeout
  res.status(200).send('ok')

  try {
    // If not completed, just update progress and bail
    if (aaiStatus && aaiStatus !== 'completed') {
      // Optional: mark some intermediate progress if you want
      // await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 70) // This line was removed
      logger.info('⏳ [WEBHOOK] Not completed yet; progress=70', { moduleId, aaiStatus })
      return
    }

    if (!aaiId) {
      logger.error('💥 [WEBHOOK] Missing transcript ID in payload', { moduleId, payload })
      throw new Error('Webhook missing transcript id')
    }

    // 2) Fetch final transcript from AssemblyAI
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) throw new Error('Missing ASSEMBLYAI_API_KEY')

    const resp = await fetch(`https://api.assemblyai.com/v2/transcript/${aaiId}`, {
      headers: { authorization: apiKey },
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`AAI fetch failed ${resp.status}: ${text}`)
    }
    const data: any = await resp.json()

    const text: string | undefined = data?.text
    if (!text || !text.trim()) {
      throw new Error('AAI returned empty transcript text')
    }

    // 3) Save transcript, bump progress
    await ModuleService.applyTranscript(moduleId, text)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 80)
    logger.info('📝 [WEBHOOK] Transcript saved', { moduleId, length: text.length })

    // 4) Generate steps and save
    const { generateVideoSteps } = await import('../services/ai/stepGenerator.js')
    
    // Get module to access s3Key for video duration extraction
    const module = await ModuleService.get(moduleId)
    if (!module?.s3Key) {
      throw new Error('Module missing s3Key for video processing')
    }
    
    // Extract video duration from S3 file for proper timestamp normalization
    const { videoDownloader } = await import('../services/ai/videoDownloader.js')
    const localVideoPath = await videoDownloader.fromS3(module.s3Key)
    const videoDuration = await videoDownloader.getVideoDurationSeconds(localVideoPath)
    
    logger.info('📹 [WEBHOOK] Video duration extracted', { moduleId, duration: videoDuration })
    
    const steps = await generateVideoSteps(text, [], { duration: videoDuration }, moduleId)
    
    // Clean up local video file
    try {
      const { unlink } = await import('fs/promises')
      await unlink(localVideoPath)
    } catch (cleanupErr: any) {
      logger.warn('⚠️ [WEBHOOK] Failed to cleanup local video file', { moduleId, error: cleanupErr?.message || cleanupErr })
    }
    
    // Save steps to S3
    const { stepSaver } = await import('../services/ai/stepSaver.js')
    await stepSaver.saveStepsToS3({
      moduleId,
      s3Key: `training/${moduleId}.json`,
      steps: steps.steps,
      transcript: text
    })
    
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 90)
    logger.info('✅ [WEBHOOK] Steps generated and saved', { moduleId, stepCount: steps.steps.length })

    // 5) Mark as ready
    await ModuleService.updateModuleStatus(moduleId, 'READY', 100)
    logger.info('🎉 [WEBHOOK] Module READY', { moduleId })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    logger.error('💥 [WEBHOOK] Failure', { moduleId, error: msg })
    try {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 100)
      await ModuleService.markError(moduleId, msg)
    } catch (persistErr: any) {
      logger.error('⚠️ [WEBHOOK] Failed to persist FAILED', { moduleId, error: persistErr?.message ?? persistErr })
    }
  }
})

export { router as webhookRoutes };
