// backend/src/routes/workerRoutes.ts
import { Router } from 'express';
import { updateModule, getModule } from '../services/moduleService';
import { transcribeFromS3, generateSteps } from '../services/aiService';
import { putJson } from '../services/storageService';
import { logger } from '../utils/logger';

const router = Router();

router.post('/jobs/processVideo', async (req, res) => {
  const { moduleId, videoKey } = req.body || {};

  if (!moduleId || !videoKey) {
    logger.warn('Missing moduleId or videoKey in processVideo request');
    return res.status(400).json({ error: 'moduleId and videoKey required' });
  }

  try {
    logger.info(`🔁 Processing job start — moduleId: ${moduleId}`);

    const mod = await getModule(moduleId);
    if (!mod) {
      logger.warn(`Module not found: ${moduleId}`);
      return res.status(404).json({ error: 'Module not found' });
    }

    await updateModule(moduleId, { status: 'PROCESSING' });

    const transcript = await transcribeFromS3(videoKey);
    const steps = await generateSteps(transcript);

    const stepsKey = `training/${moduleId}.json`;
    await putJson(stepsKey, steps);

    await updateModule(moduleId, { status: 'READY', stepsKey });

    logger.info(`✅ Job completed — moduleId: ${moduleId}, stepsKey: ${stepsKey}`);
    return res.json({ ok: true, moduleId, stepsKey });
  } catch (err: any) {
    logger.error('❌ Job failed:', err);
    try {
      await updateModule(moduleId, { status: 'ERROR' });
    } catch {
      logger.warn('Failed to mark module as ERROR');
    }
    return res.status(500).json({ error: 'processing failed', detail: err?.message });
  }
});

export default router;
