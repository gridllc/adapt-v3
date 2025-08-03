import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { aiService } from '../services/aiService.js'
import { transcribeS3Video } from '../services/transcriptionService.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'
const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')

// POST /api/reprocess/:moduleId
router.post('/:moduleId', async (req: Request, res: Response) => {
  const { moduleId } = req.params

  try {
    console.log(`🔁 Starting reprocess for module: ${moduleId}`)
    
    // Check if video file exists
    const videoPath = path.join(baseDir, 'uploads', `${moduleId}.mp4`)
    const originalFilename = `${moduleId}.mp4`

    console.log(`📁 Checking for video file at: ${videoPath}`)
    
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`)
      return res.status(404).json({
        error: 'Video file not found',
        moduleId,
        videoPath,
        message: 'Upload the video first before reprocessing'
      })
    }

    console.log(`✅ Video file found, starting AI processing...`)
    console.log(`🎬 Video path: ${videoPath}`)
    console.log(`📝 Original filename: ${originalFilename}`)

    // Trigger the AI processing
    console.log('🤖 Starting AI processing for reprocess...')
    
    // Process with AI
    const videoUrl = `http://localhost:8000/uploads/${moduleId}.mp4`
    const moduleData = await aiService.processVideo(videoUrl)
    console.log('✅ AI processing completed')
    
    // Generate steps
    const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
    console.log('✅ Steps generation completed:', steps.length, 'steps')
    
    // Start transcription in background
    transcribeS3Video(moduleId, `${moduleId}.mp4`)
      .then(() => console.log(`Transcript generated for ${moduleId}`))
      .catch(err => console.error(`Transcript generation failed for ${moduleId}:`, err))

    console.log(`✅ Reprocessing completed for module: ${moduleId}`)

    res.json({
      success: true,
      message: `Reprocessing completed for module: ${moduleId}`,
      moduleId,
      videoPath,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`❌ Failed to reprocess module ${moduleId}:`, error)
    res.status(500).json({
      error: 'Failed to reprocess module',
      details: error instanceof Error ? error.message : 'Unknown error',
      moduleId,
      timestamp: new Date().toISOString()
    })
  }
})

// GET /api/reprocess/:moduleId/status
router.get('/:moduleId/status', async (req: Request, res: Response) => {
  const { moduleId } = req.params

  try {
    console.log(`📊 Checking status for module: ${moduleId}`)
    
    // Check for video file
    const videoPath = path.join(baseDir, 'uploads', `${moduleId}.mp4`)
    const videoExists = fs.existsSync(videoPath)
    
    // Check for steps file
    const stepsPath = path.join(baseDir, 'data', 'training', `${moduleId}.json`)
    const stepsExists = fs.existsSync(stepsPath)
    
    // Check for transcript file
    const transcriptPath = path.join(baseDir, 'data', 'transcripts', `${moduleId}.json`)
    const transcriptExists = fs.existsSync(transcriptPath)
    
    const status = {
      moduleId,
      video: {
        exists: videoExists,
        path: videoPath,
        size: videoExists ? fs.statSync(videoPath).size : 0
      },
      steps: {
        exists: stepsExists,
        path: stepsPath
      },
      transcript: {
        exists: transcriptExists,
        path: transcriptPath
      },
      ready: videoExists && stepsExists,
      timestamp: new Date().toISOString()
    }
    
    console.log(`📊 Status for ${moduleId}:`, status)
    
    res.json(status)
  } catch (error) {
    console.error(`❌ Failed to get status for module ${moduleId}:`, error)
    res.status(500).json({
      error: 'Failed to get module status',
      details: error instanceof Error ? error.message : 'Unknown error',
      moduleId
    })
  }
})

export default router 