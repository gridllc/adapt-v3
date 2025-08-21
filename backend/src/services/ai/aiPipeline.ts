import { ModuleService } from '../moduleService.js'
import { presignedUploadService } from '../presignedUploadService.js'
import { submitTranscriptJob } from '../transcription/assembly.js'
import { prisma } from '../../config/database.js'
import { log } from '../../utils/logger.js'

/**
 * Starts processing for a module:
 * 1) mark PROCESSING
 * 2) require s3Key
 * 3) get signed media URL
 * 4) submit AssemblyAI job (async)
 * 5) store transcriptJobId; webhook completes pipeline
 */
export async function startProcessing(
  moduleId: string
): Promise<{ ok: boolean; transcriptJobId?: string }> {
  log.info(`🚀 [${moduleId}] startProcessing invoked`)

  try {
    const mod = await ModuleService.getModuleById(moduleId)
    if (!mod) {
      log.error(`❌ [${moduleId}] Module not found`)
      await ModuleService.updateModuleStatus(moduleId, 'FAILED')
      return { ok: false }
    }

    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 5)

    if (!mod.s3Key) {
      const msg = 'missing s3Key on module'
      log.error(`❌ [${moduleId}] ${msg}`)
      await ModuleService.updateModuleStatus(moduleId, 'FAILED')
      await prisma.module.update({ where: { id: moduleId }, data: { lastError: msg } })
      return { ok: false }
    }

    let mediaUrl: string
    try {
      mediaUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key)
    } catch (e) {
      const msg = `failed to sign playback URL: ${(e as Error)?.message || e}`
      log.error(`❌ [${moduleId}] ${msg}`)
      await ModuleService.updateModuleStatus(moduleId, 'FAILED')
      await prisma.module.update({ where: { id: moduleId }, data: { lastError: msg } })
      return { ok: false }
    }

    log.info(`🎙️ [${moduleId}] Submitting AssemblyAI job...`)
    const result = await submitTranscriptJob(moduleId, mod.s3Key)

    await prisma.module.update({
      where: { id: moduleId },
      data: { transcriptJobId: result.jobId, progress: 15 }
    })
    log.info(`✅ [${moduleId}] AssemblyAI job submitted: ${result.jobId}`)
    log.info(`🧵 [${moduleId}] startProcessing complete (awaiting webhook)`)

    // Do not mark READY here; webhook will finalize.
    return { ok: true, transcriptJobId: result.jobId }
  } catch (err: any) {
    const msg = err?.message || 'unknown processing error'
    log.error(`💥 [${moduleId}] startProcessing failed: ${msg}`)
    log.error(err?.stack || err)
    try {
      await ModuleService.updateModuleStatus(moduleId, 'FAILED')
      await prisma.module.update({ where: { id: moduleId }, data: { lastError: msg } })
    } catch (persistErr) {
      log.error(`⚠️ [${moduleId}] failed to persist FAILED state:`, persistErr)
    }
    return { ok: false }
  }
}
