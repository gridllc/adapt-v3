import express, { Request, Response } from 'express'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { aiService } from '../services/aiService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../')

// Support both data directory structures
const legacyDataDir = path.join(projectRoot, 'backend', 'src', 'data')
const newDataDir = path.resolve(__dirname, '../data/training')

// Helper function to find the correct data file
const findDataFile = async (moduleId: string) => {
  const possiblePaths = [
    path.join(legacyDataDir, 'steps', `${moduleId}.json`),
    path.join(newDataDir, `${moduleId}.json`)
  ]
  
  for (const filePath of possiblePaths) {
    try {
      await fs.promises.access(filePath)
      return filePath
    } catch {
      continue
    }
  }
  return null
}

const router = express.Router()

const stepSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  start: z.number(),
  end: z.number(),
  aliases: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

const stepsSchema = z.object({
  steps: z.array(stepSchema),
})

// Save steps for a module
router.post('/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const { steps } = stepsSchema.parse(req.body)
    
    // Try to find existing file to determine structure
    const existingFile = await findDataFile(moduleId)
    let savePath: string
    let dataToSave: any
    
    if (existingFile && existingFile.includes('training')) {
      // Use new structure with enhancedSteps
      savePath = path.join(newDataDir, `${moduleId}.json`)
      const existingData = await fs.promises.readFile(existingFile, 'utf-8').catch(() => '{}')
      const parsed = JSON.parse(existingData)
      parsed.enhancedSteps = steps
      dataToSave = parsed
    } else {
      // Use legacy structure with direct steps array
      const stepsDir = path.join(legacyDataDir, 'steps')
      savePath = path.join(stepsDir, `${moduleId}.json`)
      dataToSave = steps
      await fs.promises.mkdir(stepsDir, { recursive: true })
    }
    
    await fs.promises.writeFile(savePath, JSON.stringify(dataToSave, null, 2))
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Steps save error:', err)
    return res.status(400).json({ error: err.message || 'Failed to save steps' })
  }
})

// Get steps for a module
router.get('/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const filePath = await findDataFile(moduleId)
    
    if (!filePath) {
      return res.status(404).json({ error: 'Steps not found' })
    }
    
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    
    // Handle both data structures
    const steps = parsed.enhancedSteps || parsed.steps || parsed || []
    return res.status(200).json({ success: true, steps })
  } catch (err) {
    return res.status(404).json({ error: 'Steps not found' })
  }
})

// Delete steps for a module
router.delete('/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const filePath = await findDataFile(moduleId)
    
    if (!filePath) {
      return res.status(404).json({ error: 'Steps file not found' })
    }
    
    await fs.promises.unlink(filePath)
    console.log(`✅ Deleted steps file: ${filePath}`)
    return res.status(200).json({ success: true, message: 'Steps deleted successfully' })
  } catch (err) {
    console.error('Delete steps error:', err)
    return res.status(500).json({ error: 'Failed to delete steps' })
  }
})

// AI rewrite endpoint
router.post('/:moduleId/rewrite', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    const { text, style = 'polished' } = req.body
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Text is required' 
      })
    }

    console.log(`🤖 AI rewrite request for module ${moduleId}, style: ${style}`)
    
    const rewrittenText = await aiService.rewriteStep(text, style)
    
    res.json({ 
      success: true, 
      text: rewrittenText 
    })
  } catch (error) {
    console.error('❌ AI rewrite error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to rewrite with AI' 
    })
  }
})

export default router
