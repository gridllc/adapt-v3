// routes/stt.ts
import { Router } from 'express';
import multer from 'multer';
import { isGoogleVoiceEnabled, getVoiceStatus } from '../config/voice.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB safety
});

export const sttRouter = Router();

/**
 * POST /api/stt/google
 * multipart/form-data with field: "audio" (Blob)
 * Accepts audio/webm (opus). Keep clips short (<= 15s).
 * 
 * This endpoint is only active when:
 * - ENABLE_SERVER_VOICE=true
 * - VOICE_PROVIDER=GOOGLE
 * - ENABLE_GOOGLE_STT=true
 * - GOOGLE_PROJECT_ID is set
 * - GOOGLE_APPLICATION_CREDENTIALS is set
 */
sttRouter.post('/google', upload.single('audio'), async (req, res) => {
  // Check if Google STT is enabled using centralized config
  if (!isGoogleVoiceEnabled()) {
    const status = getVoiceStatus();
    return res.status(501).json({ 
      error: 'GOOGLE_STT_DISABLED',
      message: 'Google STT is disabled or not properly configured.',
      status,
      fallback: 'Use browser Web Speech API instead'
    });
  }

  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No audio provided' });
    }

    // Dynamic import to avoid loading Google packages when not needed
    const speech = await import('@google-cloud/speech');
    const client = new speech.v1p1beta1.SpeechClient();

    // Many Android/iOS browsers record OPUS @ 48kHz in WebM.
    // Google STT supports WEBM_OPUS in v1p1beta1.
    const audioBytes = req.file.buffer.toString('base64');

    const [response] = await client.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS' as any,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        // boost short commands
        speechContexts: [{
          phrases: [
            'next step', 'previous step', 'go to step',
            'which step', 'repeat', 'summary', 'explain',
            'pause', 'resume'
          ],
          boost: 20.0,
        }],
        model: 'default',
        useEnhanced: true,
      },
    });

    const alt = response.results?.[0]?.alternatives?.[0];
    return res.json({
      transcript: alt?.transcript ?? '',
      confidence: alt?.confidence ?? 0,
    });
  } catch (err: any) {
    console.error('STT error:', err);
    
    // Check if it's a missing package error
    const isModuleMissing = /Cannot find module|ERR_MODULE_NOT_FOUND|module not found/i.test(err?.message || '');
    
    if (isModuleMissing) {
      return res.status(501).json({ 
        error: 'GOOGLE_PACKAGES_MISSING',
        message: 'Google Cloud Speech packages not installed. Run: npm install @google-cloud/speech',
        fallback: 'Use browser Web Speech API instead'
      });
    }
    
    return res.status(500).json({ 
      error: 'stt_failed', 
      detail: err?.message || String(err),
      fallback: 'Use browser Web Speech API instead'
    });
  }
});

// Health check endpoint
sttRouter.get('/health', (req, res) => {
  const status = getVoiceStatus();
  res.json({
    ...status,
    endpoint: '/api/stt/google',
    note: isGoogleVoiceEnabled() 
      ? 'Google STT endpoint active (requires valid credentials)'
      : 'Google STT disabled - using browser Web Speech API'
  });
});
