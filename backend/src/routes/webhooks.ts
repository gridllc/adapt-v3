import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../config/database.js'
import { ModuleService } from '../services/moduleService.js'

// AssemblyAI SDK v4 - we'll use manual HMAC verification for now
// import { webhook as aaiWebhook } from 'assemblyai'

export const webhooks = Router()

// Safe timing-safe comparison that won't throw on length mismatch
function safeTimingEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    console.warn(`⚠️ Signature length mismatch: expected ${a.length}, got ${b.length}`)
    return false
  }
  try {
    return crypto.timingSafeEqual(a, b)
  } catch (err) {
    console.warn('⚠️ Timing-safe comparison failed:', err)
    return false
  }
}

// NOTE: this route receives raw body (set in server.ts)
webhooks.post('/assemblyai', async (req: any, res) => {
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET
  const NODE_ENV = process.env.NODE_ENV || 'development'
  
  if (!secret) {
    console.warn('⚠️ ASSEMBLYAI_WEBHOOK_SECRET missing — accepting webhook (dev mode)')
  }

  try {
    // req.body is a Buffer because of express.raw()
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body))
    const rawBodyString = rawBody.toString('utf8')
    
    // Get signature from headers (try multiple possible header names)
    const sig = req.get('aai-signature') ||           // AssemblyAI's current header (lowercase)
                req.get('AAI-Signature') ||            // AssemblyAI's current header (uppercase)
                req.get('x-aai-signature') ||          // legacy/edge cases
                req.get('X-AAI-Signature') ||          // legacy/edge cases
                req.get('Authorization') || ''          // some older examples used this

    console.log(`🔐 [WEBHOOK] Signature header: ${sig ? 'present' : 'missing'}`)
    console.log(`🔐 [WEBHOOK] Raw body length: ${rawBody.length} bytes`)
    console.log(`🔐 [WEBHOOK] Raw body preview: ${rawBodyString.substring(0, 100)}...`)

    let verified = true
    if (secret && sig) {
      try {
        // HMAC SHA256 of raw body - use base64 encoding to match AssemblyAI
        const expectedHmac = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
        
        // Clean the received signature (remove 'sha256=' prefix if present)
        const cleanedSig = sig.startsWith('sha256=') ? sig.slice(7) : sig
        
        console.log(`🔐 [WEBHOOK] Expected HMAC (base64): ${expectedHmac}`)
        console.log(`🔐 [WEBHOOK] Received signature: ${cleanedSig}`)
        console.log(`🔐 [WEBHOOK] Expected length: ${expectedHmac.length}, received length: ${cleanedSig.length}`)
        
        // Use safe comparison that won't throw on length mismatch
        verified = safeTimingEqual(Buffer.from(expectedHmac), Buffer.from(cleanedSig))
        
        if (!verified) {
          console.warn('⚠️ AssemblyAI webhook signature failed verification')
          // In development, accept anyway to unblock the pipeline
          if (NODE_ENV === 'development') {
            console.warn('⚠️ Development mode: accepting webhook despite signature failure')
            verified = true
          } else {
            return res.status(401).json({ ok: false, error: 'invalid signature' })
          }
        } else {
          console.log('✅ AssemblyAI webhook signature verified successfully')
        }
      } catch (hmacErr) {
        console.error('❌ HMAC verification error:', hmacErr)
        // In development, accept anyway to unblock the pipeline
        if (NODE_ENV === 'development') {
          console.warn('⚠️ Development mode: accepting webhook despite HMAC error')
          verified = true
        } else {
          return res.status(401).json({ ok: false, error: 'hmac verification failed' })
        }
      }
    }

    const payload = JSON.parse(rawBodyString)
    const moduleId = req.query.moduleId as string

    console.log('🎣 AssemblyAI webhook received:', { moduleId, status: payload.status, transcript_id: payload.id })

    if (!moduleId) {
      return res.status(400).json({ ok: false, error: 'missing moduleId' })
    }

    // You'll see statuses like: queued → processing → completed | error
    if (payload.status === 'completed') {
      // Step 5: Transcription completed, generating steps
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 70)
      console.log(`⏳ [${moduleId}] Progress: 70% - Transcription completed, generating steps`)
      
      // 1) Save transcript
      await prisma.module.update({
        where: { id: moduleId },
        data: {
          transcriptText: payload.text ?? null,
          lastError: null // Clear any previous errors
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

      // Step 6: Finalizing and marking READY
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 90)
      console.log(`⏳ [${moduleId}] Progress: 90% - Finalizing`)
      
      // Final status update to READY
      await ModuleService.updateModuleStatus(moduleId, 'READY', 100)
      console.log(`✅ [${moduleId}] transcript saved, status: READY, progress: 100%`)
      
    } else if (payload.status === 'error') {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0)
      console.log(`❌ [${moduleId}] transcription failed: ${payload.error}`)
    } else {
      // processing/queued — update progress based on status
      let progress = 50 // Default for processing
      if (payload.status === 'queued') progress = 45
      if (payload.status === 'processing') progress = 50
      
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', progress)
      console.log(`⏳ [${moduleId}] status: ${payload.status}, progress: ${progress}%`)
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('❌ Webhook handler error:', err)
    // Don't break the pipeline on webhook errors - return 200
    return res.status(200).json({ ok: false, error: 'webhook processing failed' })
  }
})
