import { Router } from "express";
import { runPipeline } from "../services/ai/aiPipeline.js";
import { prisma } from "../config/database";

const router = Router();

// Debug route to force run pipeline (bypasses QStash)
router.post('/pipeline/run', async (req, res) => {
  const { moduleId } = req.body
  const mod = await prisma.module.findUnique({ where: { id: moduleId } })

  if (!mod) {
    return res.status(404).json({ error: 'Module not found' })
  }

  await prisma.module.update({
    where: { id: moduleId },
    data: { status: 'PROCESSING', progress: 1, lastError: null }
  })

  setImmediate(() => runPipeline(moduleId, mod.s3Key!).catch(console.error))
  res.json({ success: true })
})

export default router;
