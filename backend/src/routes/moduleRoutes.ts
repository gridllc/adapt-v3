// backend/src/routes/moduleRoutes.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { ModuleService } from '../services/moduleService.js'
import { presignedUploadService } from '../services/presignedUploadService.js'
import { log } from '../utils/logger.js'
import { mustBeAuthed, currentUserId, authorizeModule } from '../middleware/auth.js'

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
 * List modules for the authenticated user only
 */
moduleRoutes.get('/', mustBeAuthed, async (req: Request, res: Response) => {
  try {
    console.log('🔍 [GET /api/modules] Starting request')
    
    let userId: string
    try {
      userId = currentUserId(req)
      console.log('✅ [GET /api/modules] User authenticated:', userId)
    } catch (authError: any) {
      console.error('❌ [GET /api/modules] Auth failed:', authError.message)
      return fail(res, 401, 'authentication_required')
    }

    console.log('📊 [GET /api/modules] Fetching modules from database')
    const rawModules = await prisma.module.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true },
    })
    
    console.log(`📦 [GET /api/modules] Found ${rawModules.length} raw modules`)

    console.log('🔄 [GET /api/modules] Processing modules with details')
    const modules = await Promise.all(
      rawModules.map(async (m, index) => {
        try {
          console.log(`📋 [GET /api/modules] Processing module ${index + 1}/${rawModules.length}: ${m.id}`)
          
          const mod = await ModuleService.get(m.id)
          if (!mod) {
            console.log(`⚠️ [GET /api/modules] Module ${m.id} not found in service`)
            return null
          }

          console.log(`✅ [GET /api/modules] Module ${m.id} loaded, status: ${mod.status}`)

          let videoUrl: string | undefined
          if (mod.status === 'READY' && mod.s3Key) {
            try {
              console.log(`🎬 [GET /api/modules] Generating video URL for ${m.id}`)
              const { presignedUploadService } = await import('../services/presignedUploadService.js')
              videoUrl = await presignedUploadService.getSignedUrl(mod.s3Key, 60 * 60) // 1 hour
              console.log(`✅ [GET /api/modules] Video URL generated for ${m.id}`)
            } catch (err: any) {
              console.log(`❌ [GET /api/modules] Video URL failed for ${m.id}:`, err.message)
              log.warn('Signed URL generation failed', { moduleId: m.id, error: err?.message })
              videoUrl = undefined
            }
          }

          console.log(`📚 [GET /api/modules] Fetching steps for ${m.id}`)
          const steps = await ModuleService.getSteps(m.id).catch((e: any) => {
            console.log(`❌ [GET /api/modules] Steps failed for ${m.id}:`, e.message)
            log.warn('getSteps failed', { moduleId: m.id, error: e?.message })
            return []
          })

          console.log(`✅ [GET /api/modules] Module ${m.id} complete with ${steps.length} steps`)
          return { ...mod, videoUrl, steps }
        } catch (moduleError: any) {
          console.error(`💥 [GET /api/modules] Error processing module ${m.id}:`, moduleError.message)
          return null
        }
      })
    )

    const filteredModules = modules.filter(Boolean)
    console.log(`🎉 [GET /api/modules] Returning ${filteredModules.length} modules`)
    return ok(res, { modules: filteredModules })
  } catch (e: any) {
    log.error('GET /api/modules failed', { error: e?.message })
    return fail(res, 500, 'failed_to_list_modules')
  }
})

/**
 * GET /api/modules/:id
 * Full module details (+optional signed playback URL + steps)
 */
moduleRoutes.get('/:id', mustBeAuthed, async (req: Request, res: Response) => {
  const id = req.params.id
  
  // ✅ CRITICAL: Guard against placeholder IDs
  if (/^<.*>$/.test(id)) {
    return fail(res, 400, 'placeholder_module_id', { message: 'Placeholder module id detected' });
  }
  
  try {
    const userId = currentUserId(req)
    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')
    
    // Verify the module belongs to the authenticated user
    if (mod.userId !== userId) {
      return fail(res, 403, 'forbidden')
    }

    let videoUrl: string | undefined
    if (mod.status === 'READY' && mod.s3Key) {
      try {
        console.log(`🎬 [moduleRoutes] Generating signed URL for module ${id} with s3Key: ${mod.s3Key}`)
        const { presignedUploadService } = await import('../services/presignedUploadService.js')
        videoUrl = await presignedUploadService.getSignedUrl(mod.s3Key, 60 * 60) // 1 hour
        console.log(`✅ [moduleRoutes] Generated signed URL: ${videoUrl?.substring(0, 100)}...`)
      } catch (err: any) {
        console.error(`❌ [moduleRoutes] Signed URL generation failed:`, err)
        log.warn('Signed URL generation failed', { moduleId: id, error: err?.message })
        videoUrl = undefined
      }
    }
    
    // ✅ CRITICAL: Ensure videoUrl is always generated for READY modules
    if (mod.status === 'READY' && !videoUrl && mod.s3Key) {
      try {
        console.log(`🔄 [moduleRoutes] Fallback: generating videoUrl for READY module ${id}`)
        const { presignedUploadService } = await import('../services/presignedUploadService.js')
        videoUrl = await presignedUploadService.getSignedUrl(mod.s3Key, 60 * 60) // 1 hour
        console.log(`✅ [moduleRoutes] Fallback generated videoUrl: ${videoUrl?.substring(0, 100)}...`)
      } catch (err: any) {
        console.error(`❌ [moduleRoutes] Fallback failed:`, err)
        log.warn('Fallback videoUrl generation failed', { moduleId: id, error: err?.message })
      }
    }

    // Load steps from S3 if module is READY, fallback to database
    let steps = []
    if (mod.status === 'READY') {
      try {
        const { storageService } = await import('../services/storageService.js')
        // Fix: Use stepsKey from database instead of hardcoding
        const stepsKey = mod.stepsKey || `training/${id}.json`
        const stepsData = await storageService.getJson(stepsKey)
        
        if (stepsData?.steps) {
          steps = stepsData.steps
          log.info('✅ Loaded steps from S3', { moduleId: id, stepCount: steps.length, stepsKey })
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
moduleRoutes.get('/:id/status', mustBeAuthed, async (req: Request, res: Response) => {
  const id = req.params.id
  
  // ✅ CRITICAL: Guard against placeholder IDs
  if (/^<.*>$/.test(id)) {
    return fail(res, 400, 'placeholder_module_id', { message: 'Placeholder module id detected' });
  }
  
  try {
    const userId = currentUserId(req)
    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')
    
    // Verify the module belongs to the authenticated user
    if (mod.userId !== userId) {
      return fail(res, 403, 'forbidden')
    }

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
moduleRoutes.get('/:id/transcript', mustBeAuthed, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    const userId = currentUserId(req)
    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')
    
    // Verify the module belongs to the authenticated user
    if (mod.userId !== userId) {
      return fail(res, 403, 'forbidden')
    }

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
moduleRoutes.delete('/:id', mustBeAuthed, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    const userId = currentUserId(req)
    log.info('Deleting module', { moduleId: id, userId })

    const mod = await ModuleService.get(id)
    if (!mod) return fail(res, 404, 'not_found')
    
    // Verify the module belongs to the authenticated user
    if (mod.userId !== userId) {
      return fail(res, 403, 'forbidden')
    }

    await prisma.module.delete({ where: { id } })

    log.info('Module deleted', { moduleId: id })
    return ok(res, { message: 'Module deleted successfully' })
  } catch (e: any) {
    log.error('DELETE /api/modules/:id failed', { moduleId: id, error: e?.message })
    return fail(res, 500, 'failed_to_delete_module')
  }
})
