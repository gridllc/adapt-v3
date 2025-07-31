import express, { Request, Response } from 'express'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../')
const dataDir = path.join(projectRoot, 'backend', 'src', 'data')

const router = express.Router()

const stepSchema = z.object({
  timestamp: z.number(),
  title: z.string().min(1),
  description: z.string(),
  duration: z.number().optional(),
})

const stepsSchema = z.object({
  steps: z.array(stepSchema),
})

// Save steps for a module
router.post('/steps/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const { steps } = stepsSchema.parse(req.body)
    const stepsDir = path.join(dataDir, 'steps')
    const savePath = path.join(stepsDir, `${moduleId}.json`)
    await fs.promises.mkdir(stepsDir, { recursive: true })
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
    const filePath = path.join(dataDir, 'steps', `${moduleId}.json`)
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const steps = JSON.parse(raw)
    return res.status(200).json({ success: true, steps })
  } catch (err) {
    return res.status(404).json({ error: 'Steps not found' })
  }
})

// Delete steps for a module
router.delete('/steps/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const filePath = path.join(dataDir, 'steps', `${moduleId}.json`)
    
    // Check if file exists before trying to delete
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
      console.log(`✅ Deleted steps file: ${filePath}`)
      return res.status(200).json({ success: true, message: 'Steps deleted successfully' })
    } else {
      return res.status(404).json({ error: 'Steps file not found' })
    }
  } catch (err) {
    console.error('Delete steps error:', err)
    return res.status(500).json({ error: 'Failed to delete steps' })
  }
})

export default router
