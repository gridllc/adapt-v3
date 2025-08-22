// backend/src/routes/moduleRoutes.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { ModuleService } from '../services/moduleService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import { log } from '../utils/logger.js'

export const moduleRoutes = Router()

/* ------------------------------- Helpers ------------------------------- */

function ok(res: Response, body: any = {}) {
  return res.json({ success: true, ...body })
}
function fail(res: Response, code = 500, error = 'internal_error', extra?: any) {
  return res.status(code).json({ success: false, error, ...(extra ?? {}) })
}

/* ------------------------------- Routes -------------------------------- */

/**
 * GET /api/modules
 * List recent modules (optionally scoped by user if auth wired)
 */
moduleRoutes.get('/', async (req: Request & { auth?: { userId?: string } }, res: Response) => {
  try {
    const userId = req.auth?.userId ?? null

    const rawModules = await prisma.module.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true },
    })

    const modules = await Promise.all(
      rawModules.map(async (m) => {
        const mod = await ModuleService.get(m.id)
        if (!mod) return null

        let videoUrl: string | undefined
        if (mod.status === 'READY' && mod.s3Key) {
          try {
            videoUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key)
          } catch (err: any) {
            log.warn('Signed URL generation failed', { moduleId: m.id, error: err?.message })
            videoUrl = undefined
          }
        }

        const steps = await ModuleService.getSteps(m.id).catch((e: any) => {
          log.warn('getSteps failed', { moduleId: m.id, error: e?.message })
          return []
        })

        return { ...mod, videoUrl, steps }
      })
    )

    return ok(res, { modules: modules.filter(Boolean) })
  } catch (e: any) {
    log.error('GET /api/modules failed', { error: e?.message })
    return fail(res, 500, 'failed_to_list_modules')
  }
})

/**
 * GET /api/modules/:id
 * Full module details (+optional signed playback URL + steps)
 */
moduleRoutes.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')

    let videoUrl: string | undefined
    if (mod.status === 'READY' && mod.s3Key) {
      try {
        videoUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key)
      } catch (err: any) {
        log.warn('Signed URL generation failed', { moduleId: id, error: err?.message })
        videoUrl = undefined
      }
    }

    // Load steps from S3 if module is READY, fallback to database
    let steps = []
    if (mod.status === 'READY') {
      try {
        const { storageService } = await import('../services/storageService.js')
        const stepsKey = `training/${id}.json`
        const stepsData = await storageService.getJson(stepsKey)
        
        if (stepsData?.steps) {
          steps = stepsData.steps
          log.info('✅ Loaded steps from S3', { moduleId: id, stepCount: steps.length })
        } else {
          log.warn('⚠️ No steps found in S3', { moduleId: id, stepsKey })
          // Fallback to database steps
          steps = await ModuleService.getSteps(id).catch((e: any) => {
            log.warn('Database steps fallback failed', { moduleId: id, error: e?.message })
            return []
          })
        }
      } catch (s3Error) {
        log.warn('⚠️ S3 steps loading failed, falling back to database', { moduleId: id, error: s3Error })
        steps = await ModuleService.getSteps(id).catch((e: any) => {
          log.warn('Database steps fallback failed', { moduleId: id, error: e?.message })
          return []
        })
      }
    } else {
      log.info('⏳ Module not ready yet, no steps to load', { moduleId: id, status: mod.status })
    }

    return ok(res, {
      module: {
        ...mod,
        videoUrl,
        transcriptText: mod.transcriptText ?? null,
        steps,
      },
    })
  } catch (e: any) {
    log.error('GET /api/modules/:id failed', { moduleId: id, error: e?.message })
    return fail(res, 500, 'failed_to_get_module')
  }
})

/**
 * GET /api/modules/:id/status
 * Lightweight poll endpoint used by frontend
 * Returns consistent shape: { success, status, progress, moduleId }
 */
moduleRoutes.get('/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')

    return ok(res, {
      status: mod.status,
      progress: mod.progress ?? 0,
      moduleId: id,
      lastError: mod.lastError ?? null,
    })
  } catch (e: any) {
    log.error('GET /api/modules/:id/status failed', { moduleId: id, error: e?.message })
    return fail(res, 500, 'failed_to_get_status')
  }
})

/**
 * GET /api/modules/:id/transcript
 * Returns transcript text (if available)
 */
moduleRoutes.get('/:id/transcript', async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')

    if (!mod.transcriptText) {
      return ok(res, {
        transcript: '',
        hasTranscript: false,
        message: 'Transcript not yet available',
      })
    }

    return ok(res, {
      transcript: mod.transcriptText,
      hasTranscript: true,
      transcriptLength: mod.transcriptText.length,
    })
  } catch (e: any) {
    log.error('GET /api/modules/:id/transcript failed', { moduleId: id, error: e?.message })
    return fail(res, 500, 'failed_to_get_transcript')
  }
})

/**
 * DELETE /api/modules/:id
 * Deletes the module row (and cascades steps if FK configured)
 */
moduleRoutes.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    log.info('Deleting module', { moduleId: id })

    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')

    await prisma.module.delete({ where: { id } })

    log.info('Module deleted', { moduleId: id })
    return ok(res, { message: 'Module deleted successfully' })
  } catch (e: any) {
    log.error('DELETE /api/modules/:id failed', { moduleId: id, error: e?.message })
    return fail(res, 500, 'failed_to_delete_module')
  }
})
