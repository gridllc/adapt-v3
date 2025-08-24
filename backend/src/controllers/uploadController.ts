// backend/src/controllers/uploadController.ts
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ModuleService } from "../services/moduleService.js";
import { presignedUploadService } from "../services/presignedUploadService.js";
import { queueOrInline } from "../services/qstashQueue.js";
import { startProcessing } from "../services/ai/aiPipeline.js";
import { log } from "../utils/logger.js";
import { currentUserId } from "../middleware/auth.js";
import { UserService } from "../services/userService.js";

// ===== INIT UPLOAD =====
export async function initUpload(req: Request, res: Response) {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ success: false, error: "missing_filename" });
    }

    // Get the authenticated user ID
    const clerkUserId = currentUserId(req);
    
    // Create user-specific S3 path
    const s3Base = `users/${clerkUserId}/modules`;
    const s3Key = `${s3Base}/${Date.now()}-${filename}`;

    // create DB record WITHOUT userId first (avoid foreign key constraint)
    const module = await ModuleService.createForFilename(filename);
    
    // Try to create user and update module, but handle gracefully if it fails
    try {
      // Ensure user exists in database
      const user = await UserService.getOrCreateClerkUser(clerkUserId);
      
      // update the module with s3Key and userId
      await ModuleService.markUploaded(module.id, s3Key, user.id);
    } catch (userError) {
      console.warn('⚠️ Failed to create user, proceeding without userId:', userError);
      // Still update the module with s3Key, just without userId
      await ModuleService.markUploaded(module.id, s3Key);
    }

    // presigned PUT url
    const presigned = await presignedUploadService.presignPut({ 
      key: s3Key, 
      contentType: contentType || "video/mp4" 
    });

    log.info("📥 [UPLOAD INIT] Created module", { moduleId: module.id, s3Key });

    // return a response that satisfies strict frontends
    return res.status(200).json({
      success: true,
      moduleId: module.id,
      s3Key,
      // common aliases so UI code doesn't throw
      uploadUrl: presigned.url,
      putUrl: presigned.url,
      presignedUrl: presigned.url, // frontend expects this
      key: s3Key, // frontend expects this
      upload: {
        method: "PUT",
        url: presigned.url,
        headers: { "Content-Type": contentType || "video/mp4" },
      },
      module, // full module object in case UI shows name/status immediately
    });
  } catch (err: any) {
    log.error("❌ [UPLOAD INIT] Failed", { error: err?.message });
    return res.status(500).json({ success: false, error: "init_failed" });
  }
}

// ===== COMPLETE UPLOAD =====
export async function completeUpload(req: Request, res: Response) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { moduleId, key } = req.body;
    if (!moduleId) {
      return res.status(400).json({ success: false, error: "Missing moduleId" });
    }

    log.info(`📬 [UPLOAD COMPLETE] Request started`, { requestId, moduleId, key });

    const module = await ModuleService.get(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    // ✅ CRITICAL: Verify S3 object exists before processing
    if (module.s3Key) {
      try {
        log.info(`🔍 [UPLOAD COMPLETE] Verifying S3 object exists`, { requestId, moduleId, s3Key: module.s3Key });
        const { presignedUploadService } = await import('../services/presignedUploadService.js');
        await presignedUploadService.headObject(module.s3Key);
        log.info(`✅ [UPLOAD COMPLETE] S3 object verified`, { requestId, moduleId });
      } catch (headError: any) {
        log.error(`❌ [UPLOAD COMPLETE] S3 object not found`, { requestId, moduleId, s3Key: module.s3Key, error: headError.message });
        return res.status(400).json({ success: false, error: "Video file not found in S3" });
      }
    }

    // Update status with logging
    log.info(`⏳ [UPLOAD COMPLETE] Marking as PROCESSING`, { requestId, moduleId });
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 10);

    // ✅ CRITICAL: Always trigger processing with comprehensive logging and error handling
    log.info(`🚀 [UPLOAD COMPLETE] Triggering queueOrInline`, { requestId, moduleId });
    
    try {
      await queueOrInline(moduleId);
      log.info(`📬 [UPLOAD COMPLETE] Processing triggered successfully`, { requestId, moduleId });
    } catch (queueError: any) {
      log.error(`❌ [UPLOAD COMPLETE] QueueOrInline failed`, { requestId, moduleId, error: queueError.message });
      
      // Try fallback inline processing
      try {
        log.info(`🔄 [UPLOAD COMPLETE] Attempting fallback inline processing`, { requestId, moduleId });
        const { startProcessing } = await import('../services/ai/aiPipeline.js');
        
        // Run processing in background to avoid blocking the response
        setImmediate(async () => {
          try {
            await startProcessing(moduleId);
            log.info(`✅ [FALLBACK] Processing completed`, { moduleId });
          } catch (fallbackError: any) {
            log.error(`❌ [FALLBACK] Processing failed`, { moduleId, error: fallbackError.message });
            try {
              await ModuleService.updateModuleStatus(moduleId, 'FAILED', 0);
            } catch (updateError) {
              log.error(`❌ [FALLBACK] Status update failed`, { moduleId, error: updateError });
            }
          }
        });
        
        log.info(`🚀 [UPLOAD COMPLETE] Fallback processing started`, { requestId, moduleId });
      } catch (fallbackSetupError: any) {
        log.error(`❌ [UPLOAD COMPLETE] Fallback setup failed`, { requestId, moduleId, error: fallbackSetupError.message });
        throw queueError; // Re-throw original error if fallback fails to setup
      }
    }

    return res.json({ success: true, moduleId, requestId });
  } catch (err: any) {
    log.error(`❌ [UPLOAD COMPLETE] Failed`, { requestId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, error: "Failed to complete upload", requestId });
  }
}
