import { Router } from "express";
import { ModuleService } from "../services/moduleService.js";
import { storageService } from "../services/storageService.js";
import { aiService } from "../services/aiService.js";

const router = Router();

/**
 * QStash job handler
 */
router.post("/processVideo", async (req, res) => {
  try {
    const { moduleId, videoKey } = req.body;
    if (!moduleId || !videoKey) {
      return res.status(400).json({ error: "moduleId and videoKey required" });
    }

    console.log(`Processing video for module ${moduleId}`);

    await ModuleService.update(moduleId, { status: "PROCESSING" });

    // 1. Transcribe
    const transcript = await aiService.transcribeFromS3(videoKey);

    // 2. Generate steps
    const steps = await aiService.generateSteps(transcript);

    // 3. Save steps JSON to S3
    const stepsKey = `training/${moduleId}.json`;
    await storageService.putJson(stepsKey, steps);

    // 4. Mark module READY
    await ModuleService.update(moduleId, {
      status: "READY",
      stepsKey,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("processVideo error", err);
    res.status(500).json({ error: "Failed to process video" });
  }
});

export default router;
