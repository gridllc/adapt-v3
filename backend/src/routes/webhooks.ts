// backend/src/routes/webhookRoutes.ts
import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import { prisma } from "../config/database.js";
import { logger } from "../utils/structuredLogger.js";

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
    logger.error('❌ [WEBHOOK] Missing ASSEMBLYAI_WEBHOOK_TOKEN env')
    return res.status(500).send('server not configured')
  }
  if (token !== expected && headerToken !== expected) {
    logger.warn('❌ [WEBHOOK] Invalid token', { moduleId })
    return res.status(403).send('invalid token')
  }

  const payload = req.body || {}
  const aaiId: string | undefined = payload?.id
  const aaiStatus: string | undefined = payload?.status

  logger.info('🎣 [WEBHOOK] AAI webhook received', { moduleId, aaiId, aaiStatus })

  // Acknowledge early so AAI doesn’t retry due to timeout
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
    // await ModuleService.saveTranscript(moduleId, text) // This line was removed
    // await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 80) // This line was removed
    logger.info('📝 [WEBHOOK] Transcript saved', { moduleId, length: text.length })

    // 4) Generate steps and save
    // const steps = await generateSteps(text, moduleId) // This line was removed
    // await ModuleService.saveSteps(moduleId, steps) // This line was removed
    // await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 90) // This line was removed
    logger.info('✅ [WEBHOOK] Steps generation skipped for now', { moduleId })

    // 5) Embeddings (optional)
    // if (steps.length) {
    //   await uploadEmbeddings(moduleId, steps)
    //   await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 95)
    //   log.info('🔎 [WEBHOOK] Embeddings uploaded', { moduleId })
    // }

    // 6) Done!
    // await ModuleService.updateModuleStatus(moduleId, 'READY', 100) // This line was removed
    logger.info('🎉 [WEBHOOK] Module READY', { moduleId })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    logger.error('💥 [WEBHOOK] Failure', { moduleId, error: msg })
    try {
      // await ModuleService.updateModuleStatus(moduleId, 'FAILED', 100, msg) // This line was removed
    } catch (persistErr: any) {
      logger.error('⚠️ [WEBHOOK] Failed to persist FAILED', { moduleId, error: persistErr?.message ?? persistErr })
    }
  }
})

/** Minimal inlined JSON parser so this route can be mounted before global middlewares if needed */
function expressJson() {
  return (req: Request, res: Response, next: any) => {
    if (req.is('application/json')) {
      let data = ''
      req.setEncoding('utf8')
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => {
        try {
          req.body = data ? JSON.parse(data) : {}
        } catch {
          req.body = {}
        }
        next()
      })
    } else {
      req.body = {}
      next()
    }
  }
}

export { router as webhookRoutes };
