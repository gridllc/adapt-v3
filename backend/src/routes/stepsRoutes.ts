import express from 'express'
import { PrismaClient } from '@prisma/client'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '../middleware/auth.js'
import { stepsController } from '../controllers/stepsController.js'
import { enqueuePipeline } from '../services/jobs/pipelineQueue.js'
import { looksUniform } from '../services/ai/stepProcessor.js'

const router = express.Router()
const prisma = new PrismaClient()
const s3 = new S3Client({ region: process.env.AWS_REGION })
const BUCKET = process.env.AWS_BUCKET_NAME!

// tiny helpers
const ok = (res: any, extra: any = {}) => res.status(200).json({ success: true, ...extra })
const fail = (res: any, code = 500, msg = 'Failed') => res.status(code).json({ success: false, error: msg })

// ---- compat helpers ----
const mmssToSec = (v: any): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (m) return (+m[1]) * 60 + (+m[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

// Accepts *either* new format (steps[]) or old format (originalSteps[])
// and always returns a normalized [{id,start,end,title,description}]
function normalizeAnySteps(data: any, fallbackDuration = 0) {
  const raw = Array.isArray(data?.steps) ? data.steps
           : Array.isArray(data?.originalSteps) ? data.originalSteps
           : [];

  const out = raw.map((s: any, i: number, arr: any[]) => {
    // new format fields
    let start = mmssToSec(s.start ?? s.startTime);
    let end   = mmssToSec(s.end   ?? s.endTime);

    // old format sometimes had mm:ss strings or only "timestamp"/"nextTimestamp"
    if (start == null) start = mmssToSec(s.timestamp);
    if (end   == null) end   = mmssToSec(s.nextTimestamp);

    // infer end from next.start if still missing
    if (end == null && i < arr.length - 1) {
      const n = arr[i + 1];
      end = mmssToSec(n.start ?? n.startTime ?? n.timestamp);
    }
    // final fallback to file duration
    if (end == null) end = fallbackDuration;

    // clamp & order
    if (fallbackDuration) {
      start = Math.max(0, Math.min(fallbackDuration, start ?? 0));
      end   = Math.max(start ?? 0, Math.min(fallbackDuration, end ?? fallbackDuration));
    } else {
      start = Math.max(0, start ?? 0);
      end   = Math.max(start, end ?? start);
    }

    return {
      id: s.id ?? `s${i + 1}`,
      start,
      end,
      title: String(s.title ?? s.text ?? s.name ?? `Step ${i + 1}`),
      description: String(s.description ?? s.details ?? ''),
    };
  });

  return out;
}

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

function makeBasicSteps(durationSec: number) {
  if (durationSec <= 0) {
    throw new Error('Cannot create basic steps: invalid duration');
  }
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
  const { moduleId } = req.params;

  try {
    const mod = await prisma.module.findUnique({ where: { id: moduleId } });
    const durationSec = Number((mod as any)?.durationSec ?? 0) || 0; // 0 = unknown

    // 1) DB
    const dbRows = await prisma.step.findMany({
      where: { moduleId },
      orderBy: [{ order: 'asc' }],
    });

    if (dbRows.length > 0) {
      const steps = dbRows.map((s, i) => ({
        id: s.id,
        start: Number(s.startTime ?? 0),
        end: Number(s.endTime ?? 0),
        title: String(s.text ?? `Step ${i + 1}`),
        description: String(s.text ?? ''),
      }));

      if (durationSec > 0 && looksUniform(steps, durationSec)) {
        return res.status(202).json({
          success: true,
          message: 'Steps still normalizing',
          steps: [],
          meta: { durationSec, source: 'uniform-db' },
        });
      }

      return ok(res, { steps, meta: { durationSec, source: 'db' } });
    }

    // 2) S3
    const s3Key = `training/${moduleId}.json`;
    try {
      const data = await readS3Json(s3Key);
      const dur = Number((mod as any)?.durationSec ?? data?.meta?.durationSec ?? 0) || 0;

      const stepsFromS3 = normalizeAnySteps(data, dur);

      if (dur > 0 && looksUniform(stepsFromS3, dur)) {
        return res.status(202).json({
          success: true,
          message: 'Steps still normalizing',
          steps: [],
          meta: { ...(data?.meta ?? {}), durationSec: dur, source: 'uniform-s3' },
        });
      }

      res.set('Cache-Control', 'no-store');
      return ok(res, {
        steps: stepsFromS3,
        transcript: data?.transcript ?? '',
        meta: { ...(data?.meta ?? {}), durationSec: dur, source: 's3' },
      });
    } catch {
      /* fall through */
    }

    // 3) Fallback ONLY if duration known — else 202 to keep polling
    if (!durationSec) {
      return res.status(202).json({ success: true, steps: [], meta: { durationSec: 0, source: 'pending' } });
    }
    const chunk = Math.max(5, Math.floor(durationSec / 3));
    const steps = [
      { id: 's1', start: 0,       end: chunk,     title: 'Intro',      description: 'Overview of the task.' },
      { id: 's2', start: chunk,   end: chunk * 2, title: 'Main Steps', description: 'Follow the core steps.' },
      { id: 's3', start: chunk*2, end: durationSec, title: 'Finish',   description: 'Wrap up and verify.' },
    ];
    res.set('Cache-Control', 'no-store');
    return ok(res, { steps, meta: { durationSec, source: 'fallback-transient' } });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Could not load steps' });
  }
});

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
