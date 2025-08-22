// backend/src/controllers/uploadController.ts
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ModuleService } from "../services/moduleService.js";
import { presignedUploadService } from "../services/presignedUploadService.js";
import { queueOrInline } from "../services/qstashQueue.js";
import { startProcessing } from "../services/ai/aiPipeline.js";
import { log } from "../utils/logger.js";

// ===== INIT UPLOAD =====
export async function initUpload(req: Request, res: Response) {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ success: false, error: "missing_filename" });
    }

    const moduleId = uuidv4();
    const s3Key = `training/${Date.now()}-${filename}`;

    // create DB record in UPLOADED state
    const module = await ModuleService.createForFilename(filename);
    
    // update the module with our generated moduleId and s3Key
    await ModuleService.markUploaded(module.id, s3Key);

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
