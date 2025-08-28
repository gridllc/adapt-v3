import { Router } from "express";
import { Receiver } from "@upstash/qstash";
import { runPipeline } from "../services/ai/aiPipeline.js";
import { prisma } from "../config/database";
import { getBaseUrl } from "../services/jobs/pipelineQueue.js";

const router = Router();
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const PUBLIC_PIPELINE_URL = `${getBaseUrl()}/api/qstash/pipeline`;

router.post("/pipeline", async (req, res) => {
  try {
    // 1) Verify request came from QStash
    const sig = req.header("Upstash-Signature");
    await receiver.verify({
      signature: sig!,
      body: req.body,            // raw Buffer from express.raw()
      url: PUBLIC_PIPELINE_URL,  // must match the public URL
    }); // throws if invalid

    // 2) Parse and start
    const { moduleId, s3Key } = JSON.parse(req.body.toString());

    await prisma.module.update({
      where: { id: moduleId },
      data: { status: "PROCESSING", progress: 1, lastError: null },
    });

    await runPipeline(moduleId, s3Key); // your robust pipeline (no Redis needed)
    return res.json({ success: true });
  } catch (e: any) {
    console.error("[QStash pipeline] error", e?.message);
    return res.status(500).json({ success: false, error: "PIPELINE_START_FAILED" });
  }
});

router.post("/success", (_req, res) => {
  // optional: record delivery success from QStash callback
  res.json({ ok: true });
});

router.post("/failure", (req, res) => {
  // optional: persist failure report so UI can show a reason
  console.error("[QStash failure callback]", req.body?.toString?.() || req.body);
  res.json({ ok: true });
});

export default router;
