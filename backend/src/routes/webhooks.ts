import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../config/database.js'
import { ModuleService } from '../services/moduleService.js'

// AssemblyAI SDK v4 - we'll use manual HMAC verification for now
// import { webhook as aaiWebhook } from 'assemblyai'

export const webhooks = Router()

// NOTE: this route receives raw body (set in server.ts)
webhooks.post('/assemblyai', async (req: any, res) => {
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET
  if (!secret) {
    console.warn('⚠️ ASSEMBLYAI_WEBHOOK_SECRET missing — accepting webhook (dev mode)')
  }

  try {
    // req.body is a Buffer because of express.raw()
    const raw = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body)
    const sig =
      req.get('AAI-Signature') ||           // AssemblyAI's current header
      req.get('X-AAI-Signature') ||         // legacy/edge cases
      req.get('Authorization') || ''        // some older examples used this

    let verified = true
    if (secret) {
      // HMAC SHA256 of raw body (supports "sha256=..." or plain hex)
      const h = crypto.createHmac('sha256', secret).update(raw).digest('hex')
      const cleanedSig = sig.startsWith('sha256=') ? sig.slice(7) : sig
      verified = crypto.timingSafeEqual(Buffer.from(h), Buffer.from(cleanedSig))
    }

    if (!verified) {
      console.warn('⚠️ AssemblyAI webhook signature failed verification')
      return res.status(401).json({ ok: false })
    }

    const payload = JSON.parse(raw)
    const moduleId = req.query.moduleId as string

    console.log('🎣 AssemblyAI webhook received:', { moduleId, status: payload.status, transcript_id: payload.id })

    if (!moduleId) {
      return res.status(400).json({ ok: false, error: 'missing moduleId' })
    }

    // You'll see statuses like: queued → processing → completed | error
    if (payload.status === 'completed') {
      // 1) Save transcript
      await prisma.module.update({
        where: { id: moduleId },
        data: {
          transcriptText: payload.text ?? null,
          status: 'READY',
          progress: 100
        }
      })

      // 2) Generate steps from transcript using our StepsService
      try {
        const { StepsService } = await import('../services/ai/stepsService.js')
        const steps = await StepsService.buildFromTranscript(payload.text ?? '')
        
        if (steps.length) {
          // Replace old steps
          await prisma.step.deleteMany({ where: { moduleId } })
          await prisma.step.createMany({
            data: steps.map((s: any, i: number) => ({
              id: undefined as any, // auto
              moduleId,
              order: s.order ?? i + 1,
              text: s.text ?? "",
              startTime: Math.max(0, Math.floor(s.startTime ?? 0)),
              endTime: Math.max(0, Math.floor(s.endTime ?? (s.startTime ?? 0) + 5)),
            })),
          })
          console.log(`✅ [${moduleId}] ${steps.length} steps created`)
        }
      } catch (e) {
        console.warn('Step generation failed (non-blocking):', e)
      }

      console.log(`✅ [${moduleId}] transcript saved, status: READY`)
    } else if (payload.status === 'error') {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0)
      console.log(`❌ [${moduleId}] transcription failed: ${payload.error}`)
    } else {
      // processing/queued — keep the module on PROCESSING, maybe bump progress
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 15)
      console.log(`⏳ [${moduleId}] status: ${payload.status}, progress: 15%`)
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ ok: false })
  }
})
