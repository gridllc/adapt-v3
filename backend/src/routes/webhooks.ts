import { Router, Request, Response } from "express";
import { ModuleService } from "../services/moduleService.js";
import { prisma } from "../config/database.js";
import { logger } from "../utils/structuredLogger.js";

const router = Router();

/**
 * AssemblyAI sends:
 * { "transcript_id": "uuid", "status": "completed" | "error" }
 * Docs: https://www.assemblyai.com/docs/deployment/webhooks
 */
router.post("/webhooks/assemblyai", async (req: Request, res: Response) => {
  try {
    // ✅ Use the already-parsed body. DO NOT JSON.parse(req.body)
    const { transcript_id, status } = req.body as {
      transcript_id?: string;
      status?: "completed" | "error";
    };

    const moduleId = String(req.query.moduleId || "");
    const token = String(req.query.token || "");

    // Optional simple auth using your shared token
    if (!process.env.ASSEMBLYAI_WEBHOOK_SECRET || token !== process.env.ASSEMBLYAI_WEBHOOK_SECRET) {
      logger.warn("[WEBHOOK] Invalid token for AssemblyAI webhook", { moduleId });
      return res.sendStatus(401);
    }

    if (!moduleId || !transcript_id || !status) {
      logger.warn("[WEBHOOK] Missing fields", { moduleId, transcript_id, status });
      return res.sendStatus(400);
    }

    logger.info("🎣 [WEBHOOK] AAI delivered", { moduleId, transcript_id, status });

    // Acknowledge early so AAI doesn't retry
    res.sendStatus(200);

    // Idempotency — bail out if this module already moved past 60%
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) return;

    if ((module.progress ?? 0) >= 80 && (module.status ?? "") !== "UPLOADED") {
      logger.info("🧊 [WEBHOOK] Duplicate/late webhook ignored", { moduleId, progress: module.progress });
      return;
    }

    if (status === "error") {
      await prisma.module.update({
        where: { id: moduleId },
        data: { 
          status: 'FAILED', 
          progress: 100, 
          lastError: 'Transcription failed via webhook' 
        }
      });
      return;
    }

    // Fetch the transcript from AssemblyAI
    const response = await fetch(`https://api.assemblyai.com/v2/transcripts/${transcript_id}`, {
      headers: { authorization: process.env.ASSEMBLYAI_API_KEY! }
    });

    if (!response.ok) {
      throw new Error(`AssemblyAI API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    const text = data.text || '';
    const words = data.words || [];
    const chapters = data.chapters || [];

    logger.info(`📝 [WEBHOOK] Transcript fetched`, { 
      moduleId, 
      textLength: text.length,
      wordCount: words.length,
      chapterCount: chapters.length
    });

    // Hand off to pipeline to generate steps and mark 100%
    await resumeAfterTranscript({ moduleId, transcriptId: transcript_id, text, words, chapters });
  } catch (err) {
    logger.error("❌ [WEBHOOK] Handler error", { error: err instanceof Error ? err.message : String(err) });
    // Nothing to return — we already attempted to reply above
  }
});

/**
 * Resume processing after transcript is received
 */
async function resumeAfterTranscript(args: {
  moduleId: string;
  transcriptId: string;
  text: string;
  words?: any[];
  chapters?: any[];
}) {
  const { moduleId, text, words, chapters } = args;
  
  try {
    // Step 1: Transcript received
    await prisma.module.update({
      where: { id: moduleId },
      data: { 
        transcriptText: text,
        progress: 70,
        lastError: null
      }
    });
    logger.info(`⏳ [${moduleId}] Progress: 70% - Transcript received`);

    // Step 2: Generate steps from transcript
    try {
      const { StepsService } = await import('../services/ai/stepsService.js');
      const steps = await StepsService.buildFromTranscript(text);
      
      if (steps.length) {
        // Replace old steps
        await prisma.step.deleteMany({ where: { moduleId } });
        await prisma.step.createMany({
          data: steps.map((s: any, i: number) => ({
            id: undefined as any, // auto
            moduleId,
            order: s.order ?? i + 1,
            text: s.text ?? "",
            startTime: Math.max(0, Math.floor(s.startTime ?? 0)),
            endTime: Math.max(0, Math.floor(s.endTime ?? (s.startTime ?? 0) + 5)),
          })),
        });
        logger.info(`✅ [${moduleId}] ${steps.length} steps created`);
      }
    } catch (stepErr) {
      logger.warn(`⚠️ [${moduleId}] Step generation failed (non-blocking):`, { error: stepErr instanceof Error ? stepErr.message : String(stepErr) });
    }

    // Step 3: Steps generated
    await prisma.module.update({
      where: { id: moduleId },
      data: { progress: 85 }
    });
    logger.info(`⏳ [${moduleId}] Progress: 85% - Steps generated`);

    // Step 4: Final status update to READY
    await prisma.module.update({
      where: { id: moduleId },
      data: { 
        status: 'READY', 
        progress: 100 
      }
    });
    logger.info(`✅ [${moduleId}] Module completed: READY, progress: 100%`);

  } catch (error) {
    logger.error(`❌ [${moduleId}] Failed to resume processing:`, { error: error instanceof Error ? error.message : String(error) });
    await prisma.module.update({
      where: { id: moduleId },
      data: { 
        status: 'FAILED', 
        progress: 0, 
        lastError: `Resume processing failed: ${error}` 
      }
    });
  }
}

export { router as webhooks };
