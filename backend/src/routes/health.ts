import { Router } from 'express';
const r = Router();

r.get('/health', (_req, res) => {
  try {
    console.log('🏥 Health check requested')
    const response = {
      ok: true,
      ts: Date.now(),
      env: process.env.NODE_ENV || 'development'
    }
    console.log('🏥 Health check response:', response)
    res.status(200).json(response)
  } catch (error) {
    console.error('🏥 Health check error:', error)
    res.status(500).json({ ok: false, error: 'Health check failed' })
  }
});

// HEAD sometimes used by your hook; respond 200 too
r.head('/health', (_req, res) => {
  console.log('🏥 HEAD health check requested')
  res.sendStatus(200)
});

export default r;
