import express, { Request, Response } from 'express'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { aiService } from '../services/aiService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Handle both development and production paths
const isProduction = process.env.NODE_ENV === 'production'
const baseDir = isProduction ? '/app' : path.resolve(__dirname, '../../')

// Define all possible paths for steps files - use absolute paths from project root
const STEPS_PATHS = [
  path.join(baseDir, 'data', 'steps'),
  path.join(baseDir, 'data', 'training'),
  path.join(baseDir, 'data', 'modules')
]

// Helper function to find the correct data file with detailed logging
const findDataFile = async (moduleId: string): Promise<{ path: string | null; foundIn: string | null }> => {
  console.log(`🔍 Searching for steps file for moduleId: ${moduleId}`)
  
  for (const basePath of STEPS_PATHS) {
    const filePath = path.join(basePath, `${moduleId}.json`)
    console.log(`📁 Checking path: ${filePath}`)
    
    try {
      await fs.promises.access(filePath)
      console.log(`✅ Found steps file at: ${filePath}`)
      return { path: filePath, foundIn: basePath }
    } catch {
      console.log(`❌ File not found at: ${filePath}`)
      continue
    }
  }
  
  console.error(`❌ No steps file found for moduleId: ${moduleId} in any of the search paths`)
  return { path: null, foundIn: null }
}

// Helper function to ensure directory exists
const ensureDirectory = async (dirPath: string): Promise<void> => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    console.log(`📁 Created/verified directory: ${dirPath}`)
  } catch (error) {
    console.error(`❌ Failed to create directory ${dirPath}:`, error)
    throw error
  }
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
    console.log(`💾 Saving steps for moduleId: ${moduleId}`)
    
    const { steps } = stepsSchema.parse(req.body)
    console.log(`📝 Received ${steps.length} steps to save`)
    
    // Try to find existing file to determine structure
    const { path: existingFile, foundIn } = await findDataFile(moduleId)
    let savePath: string
    let dataToSave: any
    
    if (existingFile && foundIn?.includes('training')) {
      // Use new structure with enhancedSteps
      savePath = path.join(baseDir, 'data', 'training', `${moduleId}.json`)
      console.log(`📁 Using training structure, saving to: ${savePath}`)
      
      const existingData = await fs.promises.readFile(existingFile, 'utf-8').catch(() => '{}')
      const parsed = JSON.parse(existingData)
      parsed.enhancedSteps = steps
      dataToSave = parsed
    } else {
      // Use legacy structure with direct steps array
      savePath = path.join(baseDir, 'data', 'steps', `${moduleId}.json`)
      console.log(`📁 Using legacy structure, saving to: ${savePath}`)
      dataToSave = steps
      await ensureDirectory(path.dirname(savePath))
    }
    
    await fs.promises.writeFile(savePath, JSON.stringify(dataToSave, null, 2))
    console.log(`✅ Successfully saved steps to: ${savePath}`)
    return res.status(200).json({ success: true, savedPath: savePath })
  } catch (err: any) {
    console.error('❌ Steps save error:', err)
    return res.status(400).json({ error: err.message || 'Failed to save steps' })
  }
})

// Get steps for a module
router.get('/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    console.log(`📖 Getting steps for moduleId: ${moduleId}`)
    console.log(`🔍 Current directory: ${__dirname}`)
    console.log(`📁 Base directory: ${baseDir}`)
    console.log(`🔍 STEPS_PATHS:`, STEPS_PATHS)
    
    const { path: filePath, foundIn } = await findDataFile(moduleId)
    
    if (!filePath) {
      console.error(`❌ Steps not found for moduleId: ${moduleId}`)
      console.error(`🔍 Searched paths:`, STEPS_PATHS)
      
      // Check if any files exist in the directories
      for (const basePath of STEPS_PATHS) {
        try {
          const files = await fs.promises.readdir(basePath)
          console.log(`📁 Files in ${basePath}:`, files)
        } catch (error) {
          console.log(`❌ Directory ${basePath} does not exist or is not accessible`)
        }
      }
      
      return res.status(404).json({ 
        error: 'Steps not found',
        moduleId,
        searchedPaths: STEPS_PATHS,
        message: 'Check server logs for detailed debugging info'
      })
    }
    
    console.log(`📄 Reading steps from: ${filePath}`)
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    
    // Handle both data structures
    const steps = parsed.enhancedSteps || parsed.steps || parsed || []
    console.log(`✅ Found ${steps.length} steps for moduleId: ${moduleId}`)
    console.log(`📊 File content keys:`, Object.keys(parsed))
    
    return res.status(200).json({ 
      success: true, 
      steps,
      source: foundIn,
      filePath,
      totalSteps: steps.length
    })
  } catch (err) {
    console.error(`❌ Error reading steps for moduleId: ${req.params.moduleId}:`, err)
    return res.status(500).json({ 
      error: 'Failed to load steps file',
      moduleId: req.params.moduleId,
      details: err instanceof Error ? err.message : 'Unknown error'
    })
  }
})

// Delete steps for a module
router.delete('/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    console.log(`🗑️ Deleting steps for moduleId: ${moduleId}`)
    
    const { path: filePath } = await findDataFile(moduleId)
    
    if (!filePath) {
      console.error(`❌ Steps file not found for deletion: ${moduleId}`)
      return res.status(404).json({ error: 'Steps file not found' })
    }
    
    await fs.promises.unlink(filePath)
    console.log(`✅ Deleted steps file: ${filePath}`)
    return res.status(200).json({ success: true, message: 'Steps deleted successfully' })
  } catch (err) {
    console.error('❌ Delete steps error:', err)
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

// Generate steps for a module
router.post('/generate/:moduleId', async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params
    console.log(`🤖 Generating steps for moduleId: ${moduleId}`)
    
    // Get video file path - use absolute path from project root
    const videoPath = path.join(baseDir, 'uploads', `${moduleId}.mp4`)
    
    console.log(`🔍 Debug paths:`)
    console.log(`  process.cwd(): ${process.cwd()}`)
    console.log(`  videoPath: ${videoPath}`)
    console.log(`  file exists: ${fs.existsSync(videoPath)}`)
    
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`)
      return res.status(404).json({ 
        success: false, 
        error: 'Video file not found',
        moduleId,
        searchedPath: videoPath
      })
    }
    
    console.log(`📹 Processing video: ${videoPath}`)
    
    // Import AudioProcessor for step generation
    const { AudioProcessor } = await import('../services/audioProcessor.js')
    const audioProcessor = new AudioProcessor()
    
    // Generate enhanced steps from video
    const enhancedSteps = await audioProcessor.generateGPTEnhancedSteps(videoPath, {
      useWordLevelSegmentation: false,
      enableGPTRewriting: true
    })
    
    console.log(`✅ Generated ${enhancedSteps.steps.length} enhanced steps`)
    
    // Save steps to file
    const stepsPath = path.join(baseDir, 'data', 'training', `${moduleId}.json`)
    await ensureDirectory(path.dirname(stepsPath))
    
    const stepsData = {
      moduleId,
      steps: enhancedSteps.steps,
      summary: enhancedSteps.summary,
      createdAt: new Date().toISOString()
    }
    
    await fs.promises.writeFile(stepsPath, JSON.stringify(stepsData, null, 2))
    console.log(`💾 Saved steps to: ${stepsPath}`)
    
    res.json({
      success: true,
      steps: enhancedSteps.steps,
      summary: enhancedSteps.summary,
      savedPath: stepsPath
    })
  } catch (error) {
    console.error(`❌ Step generation error for module ${req.params.moduleId}:`, error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate steps',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
