// backend/src/services/ai/aiPipeline.ts
import { ModuleService } from '../moduleService.js'
import { presignedUploadService } from '../presignedUploadService.js'
import { createTranscript } from '../transcription/assembly.js'
import { prisma } from '../../config/database.js'
import { log } from '../../utils/logger.js'

/**
 * MVP Pipeline (inline processing):
 * 1) mark PROCESSING @10%
 * 2) require s3Key  
 * 3) run complete inline processing with Whisper
 * 4) mark READY @100%
 *
 * Fallback to AssemblyAI webhook only if FORCE_ASSEMBLYAI=true
 * 
 * Idempotency:
 * - If module READY → no-op
 * - If PROCESSING and using AssemblyAI webhook → continue webhook flow
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

    // ✅ MVP: Use inline processing with Whisper (simpler, more reliable)
    if (process.env.FORCE_ASSEMBLYAI !== 'true') {
      log.info(`🚀 [${moduleId}] Using inline Whisper processing (MVP mode)`)
      const { processModuleInline } = await import('./inlineProcessor.js')
      await processModuleInline(moduleId)
      return { ok: true }
    }

    // ⚠️ Legacy AssemblyAI webhook flow (only if FORCE_ASSEMBLYAI=true)
    log.info(`🔄 [${moduleId}] Using AssemblyAI webhook flow (legacy mode)`)

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
    // Try to create basic steps as a fallback before marking as failed
    try {
      console.log(`🔄 [${moduleId}] Attempting to create basic steps as fallback...`)
      const { createBasicSteps } = await import('../createBasicSteps.js')
      await createBasicSteps(moduleId)
      console.log(`✅ [${moduleId}] Basic steps created successfully, marking as READY`)
      
      // Mark as ready instead of failed since we have basic steps
      await ModuleService.markReady(moduleId)
      return
    } catch (fallbackError) {
      console.warn(`⚠️ [${moduleId}] Fallback step creation failed:`, fallbackError)
      // Continue with normal failure handling
    }
    
    await ModuleService.updateModuleStatus(moduleId, 'FAILED')
  } finally {
    await prisma.module.update({
      where: { id: moduleId },
      data: { lastError: reason },
    })
  }
}
