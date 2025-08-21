import { Router } from "express";
import { ModuleService } from "../services/moduleService.js";

export const webhooks = Router();

webhooks.post("/assemblyai", async (req, res) => {
  try {
    const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET || "";
    if (secret) {
      const got = req.get("x-webhook-secret");
      if (got !== secret) {
        return res.status(401).json({ ok: false, error: "invalid_webhook_secret" });
      }
    }

    const moduleId = String(req.query.moduleId || "");
    if (!moduleId) return res.status(400).json({ ok: false, error: "missing_moduleId" });

    // AAI payload shape (minimal fields we use)
    const { status, text, error } = req.body as {
      status?: "queued" | "processing" | "completed" | "error";
      text?: string;
      error?: string;
    };

    if (status === "completed") {
      await ModuleService.applyTranscript(moduleId, text || "");
      await ModuleService.updateModuleStatus(moduleId, "READY", 100);
    } else if (status === "error") {
      await ModuleService.updateModuleStatus(moduleId, "FAILED", 0);
      // Note: We don't have a method to set lastError, so we'll use the existing markError method
      await ModuleService.markError(moduleId, error || "transcript error");
    } else {
      // processing/queued – optional progress updates
      await ModuleService.updateModuleStatus(moduleId, "PROCESSING");
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("AAI webhook error", e);
    return res.status(500).json({ ok: false });
  }
});
