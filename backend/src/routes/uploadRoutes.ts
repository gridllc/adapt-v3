import { Router } from "express";
import { storageService } from "../services/storageService.js";
import { ModuleService } from "../services/moduleService.js";
import { enqueueJob } from "../services/qstashQueue.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * Get presigned S3 upload URL
 */
router.post("/signed-url", requireAuth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType required" });
    }

    const url = await storageService.getSignedUploadUrl(filename, contentType);
    const key = `videos/${Date.now()}-${filename}`;
    res.json({ url, key });
  } catch (err) {
    console.error("signed-url error", err);
    res.status(500).json({ error: "Failed to create signed URL" });
  }
});

/**
 * Notify backend after upload complete
 */
router.post("/complete", requireAuth, async (req, res) => {
  try {
    const { videoKey, filename } = req.body;
    if (!videoKey) return res.status(400).json({ error: "videoKey required" });

    const userId = req.userId!;

    // Create new module in DB
    const module = await ModuleService.createModule({
      title: filename || "Untitled Module",
      filename: filename || "unknown.mp4",
      videoUrl: "",
      s3Key: videoKey,
      userId: userId
    });

    // Enqueue QStash job
    await enqueueJob("processVideo", { moduleId: module.id, videoKey });

    res.json({ moduleId: module.id });
  } catch (err) {
    console.error("complete error", err);
    res.status(500).json({ error: "Failed to complete upload" });
  }
});

export default router;
