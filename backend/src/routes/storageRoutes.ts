// routes/storageRoutes.ts
import { Router } from 'express'
import { storageService } from '../services/storageService.js'

export const storageRoutes = Router()

storageRoutes.get('/signed-url', async (req, res) => {
  try {
    const key = String(req.query.key || '').trim()
    if (!key) return res.status(400).json({ error: 'Missing key' })
    const url = await storageService.generateSignedUrl(key, 900)
    res.json({ url })
  } catch (err: any) {
    console.error('signed-url error', err)
    res.status(500).json({ error: 'Failed to create signed URL' })
  }
})
