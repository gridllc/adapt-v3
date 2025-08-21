import { Router } from "express";
import { prisma } from "../config/database.js";
import { log } from "../utils/logger.js";
import { AssemblyAI } from "assemblyai"; // SDK v4
import crypto from "crypto";
import { StepsService } from "../services/ai/stepsService.js"; // your basic generator

export const webhooks = Router();

/**
 * AssemblyAI signs webhooks with HMAC-SHA256 in header "Aai-Signature"
 * If ASSEMBLYAI_WEBHOOK_SECRET is set, we verify it. If not set, we still proceed (dev).
 */
function verifyAaiSignature(secret: string | undefined, rawBody: Buffer, signature: string | undefined) {
  if (!secret) return true; // allow in dev if secret not present
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// IMPORTANT: make sure your server uses express.raw({ type: 'application/json' }) JUST for this route,
// OR set `verify` on json middleware to capture rawBody. Many apps register:
// app.use('/webhooks/assemblyai', express.raw({ type: 'application/json' }));
// and then route here without JSON.parse (we'll parse manually below).

webhooks.post("/assemblyai", async (req, res) => {
  try {
    const raw = (req as any).rawBody as Buffer | undefined;      // see note above
    const sig = req.get("Aai-Signature") || req.get("aai-signature");

    // If rawBody isn't available (e.g., you didn't mount express.raw), fall back to stringifying
    const rawForVerify = raw ?? Buffer.from(JSON.stringify(req.body ?? {}));

    const ok = verifyAaiSignature(process.env.ASSEMBLYAI_WEBHOOK_SECRET, rawForVerify, sig);
    if (!ok) {
      log.warn("⚠️ AssemblyAI webhook signature failed verification");
      return res.status(401).end();
    }

    // Parse payload (handle both raw and pre-parsed)
    const payload = raw ? JSON.parse(raw.toString("utf8")) : (req.body ?? {});
    const { transcript_id, status } = payload as { transcript_id?: string; status?: string };

    // We expect moduleId on the query string from our submit call
    const moduleId = String(req.query.moduleId ?? "");

    log.info("🎣 AssemblyAI webhook", { moduleId, status, transcript_id });

    if (!moduleId || !transcript_id) {
      return res.status(400).json({ ok: false, error: "missing moduleId or transcript_id" });
    }

    // Ignore intermediate states; only act on completed/ error
    if (status && status !== "completed" && status !== "error") {
      return res.status(204).end();
    }

    if (status === "error") {
      await prisma.module.update({
        where: { id: moduleId },
        data: { status: "FAILED", lastError: "Transcription failed", progress: 0 },
      });
      return res.status(200).json({ ok: true });
    }

    // status === "completed": fetch the final transcript
    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
    const tr = await client.transcripts.get(transcript_id);

    const text = tr.text ?? "";
    // (optional) paragraphs/utterances if you want richer steps
    // const paras = await client.paragraphs({ transcriptId: transcript_id });

    // Save transcript, generate simple steps, flip READY
    const steps = await StepsService.buildFromTranscript(text); // returns Step[] with order/start/end/text

    await prisma.$transaction(async (tx) => {
      await tx.module.update({
        where: { id: moduleId },
        data: {
          transcriptText: text,
          status: "READY",
          progress: 100,
          lastError: null,
          updatedAt: new Date(),
        },
      });

      // Replace old steps
      await tx.step.deleteMany({ where: { moduleId } });
      if (steps.length) {
        await tx.step.createMany({
          data: steps.map((s: any, i: number) => ({
            id: undefined as any, // auto
            moduleId,
            order: s.order ?? i + 1,
            text: s.text ?? "",
            startTime: Math.max(0, Math.floor(s.startTime ?? 0)),
            endTime: Math.max(0, Math.floor(s.endTime ?? (s.startTime ?? 0) + 5)),
          })),
        });
      }
    });

    log.info(`✅ [${moduleId}] transcript saved, ${steps.length} steps created, READY`);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    log.error("❌ webhook error", err);
    return res.status(500).json({ ok: false });
  }
});
