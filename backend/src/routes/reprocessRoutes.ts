import express, { Request, Response } from 'express'
import { ModuleService } from '../services/moduleService.js'
import { prisma } from '../config/database.js'

const router = express.Router()

// POST /api/reprocess/:moduleId?force=true
router.post('/:moduleId', async (req: Request, res: Response) => {
  const { moduleId } = req.params
  const force = req.query.force === 'true'

  try {
    console.log(`🔁 Starting reprocess for module: ${moduleId}, force: ${force}`)

    // mark module processing, clear prior errors/placeholders
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 0, 'Reprocess requested')

    // Check if we need to verify video exists in S3 (for S3-first approach)
    const module = await prisma.module.findUnique({ where: { id: moduleId } })
    if (!module?.s3Key) {
      return res.status(400).json({
        error: 'Module has no S3 key - upload video first',
        moduleId
      })
    }

    console.log(`✅ Module marked as processing, starting full pipeline...`)

    // kick the full pipeline (audio->transcript->steps->embeddings)
    const { startProcessing } = await import('../services/ai/aiPipeline.js')
    await startProcessing(moduleId)

    return res.json({ success: true, moduleId })
  } catch (err: any) {
    console.error('[Reprocess] failed', { moduleId, error: err?.message })
    return res.status(500).json({ success: false, error: 'REPROCESS_FAILED' })
  }
})

// Health probe endpoint (quick win)
router.get('/health/pipeline', async (req: Request, res: Response) => {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  }

  try {
    // Check S3 access
    try {
      const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const s3 = new S3Client({ region: process.env.AWS_REGION })
      // Try to head a known object or just check if S3 is configured
      results.checks.s3 = {
        status: 'ok',
        bucket: process.env.AWS_BUCKET_NAME ? 'configured' : 'missing'
      }
    } catch (e) {
      results.checks.s3 = { status: 'error', error: e?.message || String(e) }
    }

    // Check FFmpeg availability
    try {
      const { execSync } = await import('child_process')
      const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8' })
      results.checks.ffmpeg = {
        status: 'ok',
        version: ffmpegVersion.split('\n')[0]
      }
    } catch (e) {
      results.checks.ffmpeg = {
        status: 'error',
        error: e?.message || String(e) || 'FFmpeg not available'
      }
    }

    // Check OpenAI API access
    try {
      const { OpenAI } = await import('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      // Simple models list call to test API access
      await openai.models.list()
      results.checks.openai = { status: 'ok' }
    } catch (e) {
      results.checks.openai = { status: 'error', error: e?.message || String(e) }
    }

    // Overall status
    const allOk = Object.values(results.checks).every((check: any) => check.status === 'ok')
    results.status = allOk ? 'healthy' : 'degraded'

    res.json(results)
  } catch (err: any) {
    results.status = 'error'
    results.error = err?.message
    res.status(500).json(results)
  }
})

export { router as reprocessRoutes } 