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
  try {
    const { moduleId } = req.body;
    if (!moduleId) {
      return res.status(400).json({ success: false, error: "Missing moduleId" });
    }

    const module = await ModuleService.get(moduleId);
    if (!module) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    // Update status
    await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 10);

    // Use the queueOrInline function which handles both QStash and inline processing
    await queueOrInline(moduleId);

    return res.json({ success: true, moduleId });
  } catch (err: any) {
    log.error("❌ [UPLOAD COMPLETE] Failed", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to complete upload" });
  }
}
