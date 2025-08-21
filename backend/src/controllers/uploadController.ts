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
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: "Missing filename" });
    }

    const moduleId = uuidv4();
    const s3Key = `training/${Date.now()}-${filename}`;

    // Create DB record
    const module = await ModuleService.createForFilename(filename);

    // Presigned PUT URL for S3 upload
    const presigned = await presignedUploadService.presignPut({ 
      key: s3Key, 
      contentType: 'video/mp4' 
    });

    log.info("📥 [UPLOAD INIT] Created module", { moduleId, s3Key });

    return res.json({
      success: true,
      module,
      uploadUrl: presigned.url,
    });
  } catch (err: any) {
    log.error("❌ [UPLOAD INIT] Failed", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to init upload" });
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
