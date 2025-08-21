import { Router } from "express";
import { prisma } from "../config/database.js";
import { generateStepsFromTranscript } from "../services/ai/stepsService.js";

export const webhooks = Router();

/**
 * AssemblyAI will POST here when the transcript is ready.
 * Make sure body parsing for JSON is enabled on your server.
 */
webhooks.post("/webhooks/assemblyai", async (req, res) => {
  try {
    const moduleId = String(req.query.moduleId || "");
    if (!moduleId) return res.status(400).end();

    const { status, text, error, id: transcriptId } = req.body || {};

    if (status === "completed") {
      // 1) store transcript
      await prisma.module.update({
        where: { id: moduleId },
        data: { transcriptText: text ?? "", transcriptJobId: transcriptId, progress: 70 }
      });

      // 2) create steps from transcript
      const steps = await generateStepsFromTranscript(text || "");
      if (steps?.length) {
        await prisma.step.createMany({
          data: steps.map((s: any, i: number) => ({
            moduleId,
            order: i,
            startTime: Math.floor(s.startTimeMs / 1000),
            endTime: Math.floor(s.endTimeMs / 1000),
            text: s.text ?? s.description ?? `Step ${i + 1}`
          }))
        });
      }

      // 3) mark READY
      await prisma.module.update({
        where: { id: moduleId },
        data: { status: "READY", progress: 100 }
      });

      return res.status(204).end();
    }

    if (status === "error") {
      await prisma.module.update({
        where: { id: moduleId },
        data: { status: "FAILED", progress: 100, lastError: error ?? "transcription failed" }
      });
      return res.status(204).end();
    }

    // queued/processing — ignore
    return res.status(204).end();
  } catch (e) {
    console.error("AAI webhook error:", e);
    return res.status(500).end();
  }
});
