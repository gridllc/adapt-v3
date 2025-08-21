// backend/src/services/ai/aiPipeline.ts
import { ModuleService } from '../moduleService.js'
import { presignedUploadService } from '../presignedUploadService.js'
import { createTranscript } from '../transcription/assembly.js'
import { prisma } from '../../config/database.js'
import { log } from '../../utils/logger.js'

/**
 * Pipeline (webhook-driven):
 * 1) mark PROCESSING @10%
 * 2) require s3Key
 * 3) generate signed playback URL
 * 4) submit AssemblyAI job (async)
 * 5) store transcriptJobId + progress=60; webhook finishes to 100%
 *
 * Idempotency:
 * - If module READY → no-op
 * - If PROCESSING with transcriptJobId and progress >= 60 → no-op (still waiting for webhook)
 */
export async function startProcessing(
  moduleId: string
): Promise<{ ok: boolean; transcriptJobId?: string }> {
  log.info(`🚀 [${moduleId}] startProcessing invoked`)

  try {
    const mod = await ModuleService.getModuleById(moduleId)
    if (!mod) {
      const msg = 'Module not found'
      log.error(`❌ [${moduleId}] ${msg}`)
      await safeFail(moduleId, msg)
      return { ok: false }
    }

    // Short-circuits to avoid duplicate work
    if (mod.status === 'READY') {
      log.info(`✅ [${moduleId}] Already READY; skipping.`)
      return { ok: true, transcriptJobId: mod.transcriptJobId ?? undefined }
    }
    if (mod.status === 'PROCESSING' && mod.transcriptJobId && (mod.progress ?? 0) >= 60) {
      log.info(`⏳ [${moduleId}] Already submitted to AAI (job=${mod.transcriptJobId}); waiting for webhook.`)
      return { ok: true, transcriptJobId: mod.transcriptJobId }
    }

    // Step 1: mark PROCESSING (10%)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 10)
    log.info(`⏳ [${moduleId}] Progress: 10% - Processing started`)

    // Step 2: require s3Key
    if (!mod.s3Key || typeof mod.s3Key !== 'string' || mod.s3Key.trim().length === 0) {
      const msg = 'Missing s3Key on module'
      log.error(`❌ [${moduleId}] ${msg}`)
      await safeFail(moduleId, msg)
      return { ok: false }
    }

    // Step 2.5: preparing media URL (25%)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 25)
    log.info(`⏳ [${moduleId}] Progress: 25% - Preparing media URL`)

    let mediaUrl: string
    try {
      mediaUrl = await presignedUploadService.getSignedPlaybackUrl(mod.s3Key)
      if (!mediaUrl || typeof mediaUrl !== 'string') {
        throw new Error('Empty signed URL')
      }
    } catch (e: any) {
      const msg = `Failed to sign playback URL: ${e?.message ?? e}`
      log.error(`❌ [${moduleId}] ${msg}`)
      await safeFail(moduleId, msg)
      return { ok: false }
    }

    // Step 3: submitting to AssemblyAI (40%)
    await ModuleService.updateModuleStatus(moduleId, 'PROCESSING', 40)
    log.info(`⏳ [${moduleId}] Progress: 40% - Submitting to AssemblyAI`)
    log.info(`🎙️ [${moduleId}] Submitting AssemblyAI job...`)

    let jobId: string
    try {
      const result = await createTranscript(moduleId, mediaUrl)
      jobId = result?.jobId
      if (!jobId) {
        throw new Error('AssemblyAI did not return a jobId')
      }
    } catch (e: any) {
      const msg = `Failed to create AssemblyAI transcript: ${e?.message ?? e}`
      log.error(`❌ [${moduleId}] ${msg}`)
      await safeFail(moduleId, msg)
      return { ok: false }
    }

    // Step 4: job accepted; record jobId and set to 60% (webhook will finish to 100%)
    await prisma.module.update({
      where: { id: moduleId },
      data: {
        transcriptJobId: jobId,
        progress: 60,
        lastError: null,
        // status stays PROCESSING; webhook will set READY/FAILED
      },
    })
    log.info(`✅ [${moduleId}] AssemblyAI job submitted: ${jobId}`)
    log.info(`⏳ [${moduleId}] Progress: 60% - Waiting for webhook`)

    return { ok: true, transcriptJobId: jobId }
  } catch (err: any) {
    const msg = err?.message || 'Unknown processing error'
    log.error(`💥 [${moduleId}] startProcessing failed: ${msg}`)
    log.error(err?.stack || err)
    try {
      await safeFail(moduleId, msg)
    } catch (persistErr: any) {
      const persistMsg = persistErr?.message || persistErr?.toString() || 'Unknown persist error'
      log.error(`⚠️ [${moduleId}] failed to persist FAILED state: ${persistMsg}`)
    }
    return { ok: false }
  }
}

/** Marks module FAILED and persists lastError. Safe to call from catch paths. */
async function safeFail(moduleId: string, reason: string) {
  try {
    await ModuleService.updateModuleStatus(moduleId, 'FAILED')
  } finally {
    await prisma.module.update({
      where: { id: moduleId },
      data: { lastError: reason },
    })
  }
}
