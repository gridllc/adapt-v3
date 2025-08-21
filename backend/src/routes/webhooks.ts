import { Router } from 'express'
import crypto from 'crypto'
import fetch from 'node-fetch'
import { prisma } from '../config/database.js'
import { ModuleService } from '../services/moduleService.js'

export const webhooks = Router()

// Safe timing-safe comparison that won't throw on length mismatch
function safeEq(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// NOTE: this route receives raw body (set in server.ts)
webhooks.post('/assemblyai', async (req: any, res) => {
  try {
    const moduleId = (req.query.moduleId as string) || ''
    if (!moduleId) {
      console.warn('❌ [WEBHOOK] Missing moduleId in query params')
      return res.status(400).send('missing moduleId')
    }

    console.log(`🎣 [WEBHOOK] AssemblyAI webhook received for module: ${moduleId}`)

    // OPTIONAL: verify shared token you appended to webhook URL
    const token = (req.query.token as string) || ''
    if (process.env.NODE_ENV === 'production') {
      if (!token || token !== process.env.ASSEMBLYAI_WEBHOOK_SECRET) {
        console.warn('❌ [WEBHOOK] Bad token in production')
        return res.status(401).send('bad token')
      }
    }

    // HMAC verification on raw body (if signature header is present)
    const hdr = req.header('aai-signature') || req.header('x-aai-signature') || ''
    if (hdr && process.env.ASSEMBLYAI_WEBHOOK_SECRET) {
      try {
        const expected = crypto.createHmac('sha256', process.env.ASSEMBLYAI_WEBHOOK_SECRET)
          .update(Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body))
          .digest('base64') // match their encoding
        
        if (!safeEq(Buffer.from(expected), Buffer.from(hdr))) {
          console.warn('❌ [WEBHOOK] Invalid signature')
          return res.status(401).send('invalid signature')
        }
        console.log('✅ [WEBHOOK] Signature verified successfully')
      } catch (hmacErr) {
        console.error('❌ [WEBHOOK] HMAC verification error:', hmacErr)
        // In development, continue anyway
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).send('hmac verification failed')
        }
      }
    }

    // Parse JSON from raw body
    const payload = JSON.parse(req.body.toString('utf8'))
    console.log(`📋 [WEBHOOK] Payload status: ${payload.status}, transcript_id: ${payload.id}`)

    // Only act when completed
    if (payload.status !== 'completed' && payload.status !== 'completed_with_error') {
      console.log(`⏭️ [WEBHOOK] Ignoring status: ${payload.status}`)
      return res.status(200).send('ignored')
    }

    if (payload.status === 'completed') {
      console.log(`✅ [WEBHOOK] Transcription completed for module: ${moduleId}`)
      
      // Step 5: Transcription completed, generating steps
      await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 70)
      console.log(`⏳ [${moduleId}] Progress: 70% - Transcription completed, generating steps`)
      
      try {
        // Fetch transcript text using transcript_id from payload
        const transcriptId = payload.id || payload.transcript_id
        console.log(`📥 [WEBHOOK] Fetching transcript text for ID: ${transcriptId}`)
        
        const resp = await fetch(`https://api.assemblyai.com/v2/transcripts/${transcriptId}`, {
          headers: { 
            Authorization: process.env.ASSEMBLYAI_API_KEY!,
            'Content-Type': 'application/json'
          }
        })
        
        if (!resp.ok) {
          throw new Error(`AssemblyAI API error: ${resp.status} ${resp.statusText}`)
        }
        
        const data: any = await resp.json()
        const text = data.text || ''
        
        console.log(`📝 [WEBHOOK] Transcript text length: ${text.length} characters`)
        console.log(`📝 [WEBHOOK] Transcript preview: ${text.substring(0, 100)}...`)
        
        // Save transcript to database
        await prisma.module.update({
          where: { id: moduleId },
          data: {
            transcriptText: text,
            lastError: null // Clear any previous errors
          }
        })
        console.log(`💾 [WEBHOOK] Transcript saved to database`)
        
        // Generate steps from transcript using StepsService
        try {
          const { StepsService } = await import('../services/ai/stepsService.js')
          const steps = await StepsService.buildFromTranscript(text)
          
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
        } catch (stepErr) {
          console.warn('⚠️ [WEBHOOK] Step generation failed (non-blocking):', stepErr)
        }
        
        // Step 6: Finalizing and marking READY
        await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 90)
        console.log(`⏳ [${moduleId}] Progress: 90% - Finalizing`)
        
        // Final status update to READY
        await ModuleService.updateModuleStatus(moduleId, 'READY', 100)
        console.log(`✅ [${moduleId}] Module completed: READY, progress: 100%`)
        
        return res.status(200).send('ok')
        
      } catch (fetchErr) {
        console.error('❌ [WEBHOOK] Failed to fetch transcript:', fetchErr)
        
        // Mark as failed but don't break the webhook
        await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0)
        await prisma.module.update({ 
          where: { id: moduleId }, 
          data: { lastError: `Failed to fetch transcript: ${fetchErr}` } 
        })
        
        return res.status(200).send('transcript fetch failed')
      }
      
    } else {
      // completed_with_error
      console.log(`❌ [WEBHOOK] Transcription failed for module: ${moduleId}`)
      
      await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0)
      await prisma.module.update({
        where: { id: moduleId },
        data: { 
          status: 'FAILED', 
          lastError: payload.error || 'transcription failed', 
          progress: 0 
        }
      })
      
      console.log(`❌ [${moduleId}] Transcription failed: ${payload.error}`)
      return res.status(200).send('transcription failed')
    }
    
  } catch (err) {
    console.error('❌ [WEBHOOK] Webhook handler error:', err)
    // Never block completion loop on webhook—ack and let polling re-try reads
    return res.status(200).send('webhook processing failed')
  }
})
