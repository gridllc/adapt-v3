import { Router } from 'express'
import fetch from 'node-fetch'
import { prisma } from '../config/database.js'

const router = Router()

router.post('/assemblyai', async (req, res) => {
  try {
    const moduleId = String(req.query.moduleId || '')
    const token = String(req.query.token || '')
    
    if (!moduleId) {
      console.warn('❌ [WEBHOOK] Missing moduleId')
      return res.status(400).send('missing moduleId')
    }

    console.log(`🎣 [WEBHOOK] AssemblyAI webhook received for module: ${moduleId}`)

    // Simple token check (good enough to unblock)
    if (process.env.NODE_ENV === 'production') {
      if (!token || token !== process.env.ASSEMBLYAI_WEBHOOK_SECRET) {
        console.warn('❌ [WEBHOOK] Invalid token in production')
        return res.status(401).send('bad token')
      }
    }

    const payload = JSON.parse(
      Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)
    )

    console.log(`📋 [WEBHOOK] Payload status: ${payload.status}, transcript_id: ${payload.id}`)

    // Ignore non-terminal updates
    const status = payload.status
    if (!['completed', 'error', 'completed_with_error'].includes(status)) {
      console.log(`⏭️ [WEBHOOK] Ignoring status: ${status}`)
      return res.status(200).send('ignored')
    }

    if (status === 'completed') {
      console.log(`✅ [WEBHOOK] Transcription completed for module: ${moduleId}`)
      
      const transcriptId = payload.id || payload.transcript_id
      console.log(`📥 [WEBHOOK] Fetching transcript text for ID: ${transcriptId}`)
      
      // Fetch final transcript text
      const r = await fetch(`https://api.assemblyai.com/v2/transcripts/${transcriptId}`, {
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY! }
      })
      
      if (!r.ok) {
        throw new Error(`AssemblyAI API error: ${r.status} ${r.statusText}`)
      }
      
      const data: any = await r.json()
      const text = data.text || ''
      
      console.log(`📝 [WEBHOOK] Transcript text length: ${text.length} characters`)
      console.log(`📝 [WEBHOOK] Transcript preview: ${text.substring(0, 100)}...`)

      // Update module to READY with transcript
      await prisma.module.update({
        where: { id: moduleId },
        data: { 
          transcriptText: text, 
          status: 'READY', 
          progress: 100,
          lastError: null
        }
      })
      
      console.log(`✅ Module ${moduleId} READY`)
      
    } else {
      console.log(`❌ [WEBHOOK] Transcription failed for module: ${moduleId}`)
      
      await prisma.module.update({
        where: { id: moduleId },
        data: { 
          status: 'FAILED', 
          progress: 100, 
          lastError: payload.error || 'transcription failed' 
        }
      })
      
      console.error(`❌ Module ${moduleId} ERROR from AssemblyAI`)
    }

    return res.status(200).send('ok')
  } catch (err) {
    console.error('❌ [WEBHOOK] Webhook error:', err)
    // Acknowledge to prevent retries storm; leave module as-is
    return res.status(200).send('ok')
  }
})

export { router as webhooks }
