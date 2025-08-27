import express from 'express'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '../middleware/auth.js'

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
  try {
    console.info('📖 Getting steps for', moduleId)

    // 1) DB first
    const dbSteps = await prisma.step.findMany({
      where: { moduleId },
      orderBy: [{ start: 'asc' }],
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
                start: Math.max(0, Number(s.start) || 0),
                end: Math.max(0, Number(s.end) || 0),
                title: String(s.title || `Step ${i + 1}`),
                description: String(s.description || ''),
              },
            })
          )
        ).catch(err => console.warn('[steps hydrate→DB] skipped:', err?.message))
        return ok(res, { steps: data.steps, transcript: data.transcript ?? '', meta: data.meta ?? {} })
      }
    } catch (_) {
      // not found is fine; fall through
    }

    // 3) Still nothing → create safe fallback so UI is never empty
    //    Use module duration if you stored it; otherwise default to 60s
    const module = await prisma.module.findUnique({ where: { id: moduleId } })
    const durationSec = Number((module as any)?.durationSec || 60)
    const steps = makeBasicSteps(durationSec)

    // persist minimal JSON so future loads don't loop
    await writeS3Json(s3Key, {
      steps,
      meta: { durationSec, source: 'fallback' },
      transcript: '',
    })

    // (optional) seed DB in background
    prisma.$transaction(
      steps.map((s, i) =>
        prisma.step.create({
          data: {
            moduleId,
            start: s.start,
            end: s.end,
            title: s.title,
            description: s.description,
          },
        })
      )
    ).catch(err => console.warn('[steps seed→DB] skipped:', err?.message))

    return ok(res, { steps, meta: { durationSec, source: 'fallback' } })
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
    
    const { startProcessing } = await import('../services/ai/aiPipeline.js')
    setImmediate(() => startProcessing(moduleId).catch((e: any) => console.error('manual gen fail', e)))
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
