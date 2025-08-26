// routes/debugRoutes.ts
import { Router } from 'express'
import crypto from 'crypto'
import fetch from 'node-fetch'

const router = Router()

// TODO: replace with your actual services
import { prisma } from '../config/database.js'
import { storageService } from '../services/storageService.js' // must expose headObject(key) & getSignedUrl(key)
import { aiService } from '../services/aiService.js'           // must expose getSteps(moduleId) and getJobStatus(moduleId)

router.get('/module/:id', async (req, res) => {
  const traceId = crypto.randomBytes(6).toString('hex')
  const log = (msg: string, extra: Record<string, any> = {}) =>
    console.log(`[DEBUG ${traceId}] ${msg}`, extra)

  try {
    const { id } = req.params
    log('start', { moduleId: id })

    // 1) DB lookup
    const moduleRec = await prisma.module.findUnique({ where: { id } })
    if (!moduleRec) return res.status(404).json({ ok: false, traceId, step: 'db', error: 'Module not found' })
    log('db.ok', { s3Key: moduleRec.videoUrl, status: moduleRec.status })

    // 2) S3 HEAD
    const key = moduleRec.s3Key || moduleRec.videoUrl
    if (!key) {
      return res.status(400).json({ 
        ok: false, 
        traceId, 
        step: 's3', 
        error: 'Module missing s3Key - cannot determine S3 location' 
      })
    }
    const head = await storageService.headObject(key) // should throw if missing
    log('s3.head.ok', { contentLength: head.ContentLength, contentType: head.ContentType })

    // 3) Presign
    const url = await storageService.generateSignedUrl(key, 300)
    log('s3.presign.ok')

    // 4) Range GET first 1KB (proves Range support & CORS OK server-side)
    const rangeResp = await fetch(url, { headers: { Range: 'bytes=0-1023' } })
    const rangeOK = rangeResp.status === 206 || rangeResp.status === 200
    log('s3.range', { status: rangeResp.status, rangeOK })

    // 5) Steps existence
    const steps = await aiService.getSteps(id) // return [] if none
    log('steps.ok', { count: steps?.length ?? 0 })

    // 6) Job status (QStash/queue/worker)
    const job = await aiService.getJobStatus?.(id).catch(() => null)
    log('job.status', job || { job: 'unknown' })

    return res.json({
      ok: true,
      traceId,
      module: {
        id,
        status: moduleRec.status,
        s3Key: key,
        contentLength: head.ContentLength,
        contentType: head.ContentType,
        signedUrlSample: url.split('?')[0],
      },
      s3: { rangeOK, headOk: true },
      steps: { count: steps?.length ?? 0 },
      job: job || null
    })
  } catch (err: any) {
    console.error('[DEBUG ERROR]', err)
    return res.status(500).json({ ok: false, error: err?.message || 'unknown', stack: err?.stack })
  }
})

export default router 