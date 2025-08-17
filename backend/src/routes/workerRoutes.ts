// backend/src/routes/workerRoutes.ts
import { Router } from 'express';
import { updateModule, getModule } from '../services/moduleService';
import { transcribeAudio, generateVideoSteps } from '../services/ai/index.js';
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

    // transcribeAudio expects (audioPath, moduleId) - we need to convert videoKey to audio path
    // generateVideoSteps expects (transcript, segments, metadata, moduleId)
    const transcript = await transcribeAudio(videoKey, moduleId);
    const steps = await generateVideoSteps(
      transcript.text, 
      transcript.segments, 
      { duration: 0 }, // TODO: Get actual video duration
      moduleId
    );

    const stepsKey = `training/${moduleId}.json`;
    await putJson(stepsKey, steps);

    await updateModule(moduleId, { status: 'READY', stepsKey });

    logger.info(`✅ Job completed — moduleId: ${moduleId}, stepsKey: ${stepsKey}`);
    return res.json({ ok: true, moduleId, stepsKey });
  } catch (err: any) {
    logger.error('❌ Job failed:', err);
    try {
      await updateModule(moduleId, { status: 'FAILED' });
    } catch {
      logger.warn('Failed to mark module as ERROR');
    }
    return res.status(500).json({ error: 'processing failed', detail: err?.message });
  }
});

export { router as workerRoutes };
export default router;
