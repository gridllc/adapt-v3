import express, { Router } from "express";
import { prisma } from "../config/database.js";
import { ModuleService } from "../services/moduleService.js";
import { getTranscript } from "../services/transcription/assembly.js";
import { generateStepsFromTranscript } from "../services/ai/stepsService.js";

// NOTE: if you added signature verification earlier, you can keep it.
// This version keeps it simple: JSON body + status switch.

export const webhooks = Router();

// AssemblyAI posts JSON
webhooks.post("/assemblyai", express.json({ type: "application/json" }), async (req, res) => {
  try {
    // We passed ?moduleId=... when submitting the job
    const moduleId = String(req.query.moduleId || "");
    if (!moduleId) return res.status(400).json({ ok: false, error: "missing moduleId" });

    const payload = req.body ?? {};
    const jobId: string | undefined = payload.id || payload.transcript_id;
    const status: string | undefined = payload.status;

    if (!jobId) return res.status(400).json({ ok: false, error: "missing jobId" });

    // Early statuses – nothing to do
    if (!status || status === "queued" || status === "processing" || status === "uploaded") {
      await ModuleService.updateModuleStatus(moduleId, "PROCESSING", 20);
      return res.json({ ok: true, status });
    }

    if (status === "error") {
      const msg = payload.error || "transcription failed";
      await ModuleService.updateModuleStatus(moduleId, "FAILED", 0);
      await ModuleService.markError(moduleId, msg);
      return res.json({ ok: true, status: "failed" });
    }

    // COMPLETED: get text (webhook may include text, but fetch to be safe)
    let transcriptText: string = (payload.text as string) || "";
    if (!transcriptText) {
      const t = await getTranscript(jobId);
      transcriptText = t.text || "";
    }

    // Persist transcriptText + status
    await ModuleService.applyTranscript(moduleId, transcriptText);

    // Create steps (naive sentence-based)
    const steps = generateStepsFromTranscript(transcriptText);
    if (steps.length) {
      // Replace old steps if any
      await prisma.step.deleteMany({ where: { moduleId } });
      await prisma.step.createMany({
        data: steps.map((s: any, idx: number) => ({
          id: undefined as any,        // let prisma generate cuid
          moduleId,
          order: idx,
          text: s.text,
          startTime: s.startTime,
          endTime: s.endTime,
          aiConfidence: null,
          confusionScore: null,
          createdAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    // Mark module READY
    await ModuleService.updateModuleStatus(moduleId, "READY", 100);

    return res.json({ ok: true, status: "completed", steps: steps.length });
  } catch (err: any) {
    console.error("AAI webhook error:", err);
    return res.status(500).json({ ok: false });
  }
});
