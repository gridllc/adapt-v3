import express, { Request, Response } from 'express'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const router = express.Router()

const bodySchema = z.object({
  transcript: z.union([
    z.string(),
    z.array(z.object({
      text: z.string(),
      start: z.number().optional(),
      end: z.number().optional(),
    })),
  ]),
})

router.post('/transcript/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const { transcript } = bodySchema.parse(req.body)

    const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
    await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
    await fs.promises.writeFile(savePath, JSON.stringify(transcript, null, 2))

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Transcript save error:', err)
    return res.status(400).json({ error: err.message || 'Failed to save transcript' })
  }
})

router.get('/transcript/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const filePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const transcript = JSON.parse(raw)

    return res.status(200).json({ success: true, transcript })
  } catch (err) {
    return res.status(404).json({ error: 'Transcript not found' })
  }
})

export default router