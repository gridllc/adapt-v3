import express from 'express'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '../middleware/auth.js'
import { stepsController } from '../controllers/stepsController.js'
import { enqueuePipeline } from '../services/jobs/pipelineQueue.js'
import { looksUniform } from '../services/ai/stepProcessor.js'
import { ModuleService } from '../services/moduleService.js'

const router = express.Router()
const prisma = new PrismaClient()
const s3 = new S3Client({ region: process.env.AWS_REGION })
const BUCKET = process.env.AWS_BUCKET_NAME!

// tiny helpers
const ok = (res: any, extra: any = {}) => res.status(200).json({ success: true, ...extra })
const fail = (res: any, code = 500, msg = 'Failed') => res.status(code).json({ success: false, error: msg })

// CRITICAL: Clamp steps to real duration before returning (catches any bad timestamps)
const clampSteps = (raw: any[], dur: number) =>
  raw.map((s, i) => {
    let start = Number(s.start ?? s.startTime ?? s.timestamp ?? 0);
    let end = Number(s.end ?? s.endTime ?? s.nextTimestamp ?? start);

    // Clamp to duration if we know it
    if (dur > 0) {
      start = Math.max(0, Math.min(dur, start));
      end = Math.max(start, Math.min(dur, end));
    }

    return {
      id: s.id ?? `s${i + 1}`,
      start,
      end,
      title: String(s.title ?? s.text ?? s.name ?? `Step ${i + 1}`),
      description: String(s.description ?? s.details ?? ''),
    };
  });

// CRITICAL: Infer duration when missing (fixes placeholder leakage)
const inferDuration = (dur: number, steps: any[]) => {
  if (dur && Number.isFinite(dur)) return dur;
  const maxEnd = Math.max(0, ...steps.map(s => Number(s.end ?? s.endTime ?? s.nextTimestamp ?? 0)));
  return Number.isFinite(maxEnd) && maxEnd > 0 ? maxEnd : 0;
};



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

// Get steps for a specific module (public) - NO PLACEHOLDERS, just real data or 202
router.get('/:moduleId', async (req, res) => {
  const { moduleId } = req.params;

  try {
    const mod = await prisma.module.findUnique({ where: { id: moduleId } });

    // Belt-and-suspenders: ensure real duration before clamping
    let ensured = await ModuleService.ensureDurationSec(moduleId);
    const durationSec = Number((mod as any)?.durationSec ?? 0) || 0;

    // 1) DB
    const dbRows = await prisma.step.findMany({
      where: { moduleId },
      orderBy: [{ order: 'asc' }],
    });

    if (dbRows.length > 0) {
      // Infer duration if module duration is unknown (prefer ensured value)
      let dur = Number(ensured ?? (mod as any)?.durationSec ?? 0) || 0;
      dur = inferDuration(dur, dbRows);

      const steps = clampSteps(dbRows, dur);

      // Reject any uniform placeholder grids (even if duration was inferred)
      if (dur > 0 && looksUniform(steps, dur)) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        return res.status(202).json({
          success: true,
          steps: [],
          meta: { durationSec: dur, source: 'uniform-db' },
          message: 'Steps still normalizing'
        });
      }

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.status(200).json({
        success: true,
        steps,
        meta: { durationSec: dur, source: 'db' }
      });
    }

    // 2) S3
    const s3Key = `training/${moduleId}.json`;
    try {
      const data = await readS3Json(s3Key);
      const stepsRaw = (data?.steps ?? data?.originalSteps ?? []);

      // 1) Infer duration if module/meta missing (prefer ensured value)
      let dur = Number(ensured ?? (mod as any)?.durationSec ?? data?.meta?.durationSec ?? 0) || 0;
      dur = inferDuration(dur, stepsRaw);

      // 2) Normalize + clamp
      const steps = clampSteps(stepsRaw, dur);

      // 3) Block uniform placeholders even if dur came from maxEnd
      if (dur > 0 && looksUniform(steps, dur)) {
        return res.status(202).json({
          success: true,
          steps: [],
          meta: { durationSec: dur, source: 'uniform-s3' },
          message: 'Steps still normalizing'
        });
      }

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.status(200).json({
        success: true,
        steps,
        transcript: data?.transcript ?? '',
        meta: { ...(data?.meta ?? {}), durationSec: dur, source: 's3' },
      });
    } catch {
      /* no S3 file yet */
    }

    // 3) Nothing real yet → tell FE to wait (no placeholders!)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(202).json({
      success: true,
      steps: [],
      meta: { durationSec, source: 'pending' }
    });

  } catch (err: any) {
    console.error('[GET /steps/:moduleId] ERROR', err?.message);
    return res.status(500).json({ success: false, error: 'Could not load steps' });
  }
});

// Generate steps using AI for a module (smart secret protection) - Frontend expects this route
// MUST come before /:moduleId to avoid route conflicts
router.post('/generate/:moduleId', async (req, res) => {
  // Enforce secret only in production, and only if set
  const expected = process.env.GENERATE_SECRET;
  const provided = req.header('x-generate-secret');

  if (process.env.NODE_ENV === 'production' && expected && provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
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
