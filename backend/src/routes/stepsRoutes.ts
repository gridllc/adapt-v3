import express from 'express'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '../middleware/auth.js'
import { stepsController } from '../controllers/stepsController.js'
import { enqueuePipeline } from '../services/jobs/pipelineQueue.js'

const router = express.Router()
const prisma = new PrismaClient()
const s3 = new S3Client({ region: process.env.AWS_REGION })
const BUCKET = process.env.AWS_BUCKET_NAME!

// tiny helpers
const ok = (res: any, extra: any = {}) => res.status(200).json({ success: true, ...extra })
const fail = (res: any, code = 500, msg = 'Failed') => res.status(code).json({ success: false, error: msg })

async function readS3Json(key: string) {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const text = await out.Body!.transformToString()
  return JSON.parse(text)
}
async function writeS3Json(key: string, data: any) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: 'application/json',
    Body: JSON.stringify(data),
    ACL: 'private',
  }))
}

function makeBasicSteps(durationSec = 60) {
  // 3 safe placeholders so the UI renders and click-to-seek works
  const chunk = Math.max(5, Math.floor(durationSec / 3))
  return [
    { id: 's1', start: 0,          end: chunk,        title: 'Intro',       description: 'Overview of the task.' },
    { id: 's2', start: chunk,      end: chunk * 2,    title: 'Main Steps',  description: 'Follow the core steps.' },
    { id: 's3', start: chunk * 2,  end: durationSec,  title: 'Finish',      description: 'Wrap up and verify.' },
  ]
}

// Get steps for a specific module (public)
router.get('/:moduleId', async (req, res) => {
  const { moduleId } = req.params
  const rid = (req as any).rid || 'no-rid'
  try {
    console.info('[STEPS] Getting steps for', { moduleId, rid })

    // 1) DB first
    const dbSteps = await prisma.step.findMany({
      where: { moduleId },
      orderBy: [{ order: 'asc' }],
    })
    if (dbSteps.length > 0) {
      return ok(res, { steps: dbSteps })
    }

    // 2) Try S3 JSON (source of truth)
    const s3Key = `training/${moduleId}.json`
    try {
      const data = await readS3Json(s3Key)
      if (Array.isArray(data?.steps) && data.steps.length > 0) {
        // (optional) hydrate DB in background
        prisma.$transaction(
          data.steps.map((s: any, i: number) =>
            prisma.step.create({
              data: {
                moduleId,
                order: i,
                startTime: Math.max(0, Number(s.start) || 0),
                endTime: Math.max(0, Number(s.end) || 0),
                text: String(s.title || s.description || `Step ${i + 1}`),
              },
            })
          )
        ).catch(err => console.warn('[steps hydrate→DB] skipped:', err?.message))
        res.set('Cache-Control', 'no-store')
        return ok(res, { steps: data.steps, transcript: data.transcript ?? '', meta: data.meta ?? {} })
      }
    } catch (_) {
      // not found is fine; fall through
    }

    // 3) Transient fallback (DO NOT persist). Just return something so UI renders,
    // and let the client continue polling for real steps written by the pipeline.
    const module = await prisma.module.findUnique({ where: { id: moduleId } })
    const durationSec = Number((module as any)?.durationSec || 60)
    const chunk = Math.max(5, Math.floor(durationSec / 3))
    const steps = [
      { id: 's1', start: 0,          end: chunk,        title: 'Intro',       description: 'Overview of the task.' },
      { id: 's2', start: chunk,      end: chunk * 2,    title: 'Main Steps',  description: 'Follow the core steps.' },
      { id: 's3', start: chunk * 2,  end: durationSec,  title: 'Finish',      description: 'Wrap up and verify.' },
    ]

    // NOTE: no write to S3 here, no DB seed here.
    res.set('Cache-Control', 'no-store')
    return res.status(200).json({
      success: true,
      steps,
      meta: { durationSec, source: 'fallback-transient' },
    })
  } catch (err: any) {
    console.error('[GET /steps/:moduleId] ERROR', err?.message)
    return fail(res, 500, 'Could not load steps')
  }
})

// Generate steps using AI for a module (simple secret protection) - Frontend expects this route
// MUST come before /:moduleId to avoid route conflicts
router.post('/generate/:moduleId', async (req, res) => {
  // simple safeguard with a shared secret, or remove entirely if you trust the FE
  if (process.env.GENERATE_SECRET && req.get('x-generate-secret') !== process.env.GENERATE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { moduleId } = req.params
  
  try {
    // Check module status first to prevent duplicate processing
    const { ModuleService } = await import('../services/moduleService.js')
    const mod = await ModuleService.getModuleById(moduleId)
    
    if (!mod.success || !mod.module) {
      return res.status(404).json({ error: 'Module not found' })
    }
    
    if (mod.module.status === 'PROCESSING') {
      return res.status(202).json({ status: 'PROCESSING' }) // no second run
    }
    
    const module = mod.module

    // Use QStash toggle - queue for prod, inline for dev
    if (process.env.QSTASH_ENABLED === "true") {
      await enqueuePipeline(moduleId, module.s3Key) // queue job (prod/staging)
      console.info('[AIPipeline] enqueued to QStash', { moduleId })
    } else {
      const { runPipeline } = await import('../services/ai/aiPipeline.js')
      setImmediate(async () => {
        try {
          await runPipeline(moduleId, module.s3Key)
        } catch (e: any) {
          console.error('manual gen fail', e)
        }
      })
      console.info('[AIPipeline] started inline', { moduleId })
    }
    res.json({ ok: true, moduleId })
  } catch (error) {
    console.error('Error in generate steps:', error)
    res.status(500).json({ error: 'Failed to start processing' })
  }
})

// Create steps for a module (protected)
router.post('/:moduleId', requireAuth, stepsController.createSteps)

// Update steps for a module (protected)
router.put('/:moduleId', requireAuth, stepsController.updateSteps)

// AI rewrite endpoint (protected)
router.post('/:moduleId/rewrite', requireAuth, stepsController.rewriteStep)

export { router as stepsRoutes }
