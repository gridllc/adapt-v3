import express, { Request, Response } from 'express'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

const router = express.Router()

const stepSchema = z.object({
  stepTitle: z.string().min(1),
  text: z.string().min(1),
  timestamp: z.number().optional(),
})
const stepsSchema = z.object({
  steps: z.array(stepSchema),
})

// Save steps for a module
router.post('/steps/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const { steps } = stepsSchema.parse(req.body)
    const savePath = path.resolve(__dirname, `../data/steps/${moduleId}.json`)
    await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
    await fs.promises.writeFile(savePath, JSON.stringify(steps, null, 2))
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Steps save error:', err)
    return res.status(400).json({ error: err.message || 'Failed to save steps' })
  }
})

// Get steps for a module
router.get('/steps/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const filePath = path.resolve(__dirname, `../data/steps/${moduleId}.json`)
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const steps = JSON.parse(raw)
    return res.status(200).json({ success: true, steps })
  } catch (err) {
    return res.status(404).json({ error: 'Steps not found' })
  }
})

export default router
