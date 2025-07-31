import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
import { createTrainingStepsFromVideo, generateEnhancedSteps, generateGPTEnhancedSteps } from '../services/audioProcessor.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { transcribeS3Video } from '../services/transcriptionService.js'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      const originalname = file.originalname

      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      // Upload to storage and get the moduleId that was actually used
      const { moduleId, videoUrl } = await storageService.uploadVideo(file)

      // Process with AI using the actual video URL
      const moduleData = await aiService.processVideo(videoUrl)

      // Generate and save steps for the module
      const steps = await aiService.generateStepsForModule(moduleId, videoUrl)

      // NEW: Create structured training steps from transcription
      let trainingData: any = null;
      let enhancedSteps: any = null;
      try {
        console.log(`🎯 Creating structured training steps for module: ${moduleId}`)
        
        // Get the actual video file path
        const videoPath = path.join(__dirname, '../uploads', `${moduleId}.mp4`)
        
        // Create structured training steps with enhanced formatting
        trainingData = await createTrainingStepsFromVideo(videoPath, {
          maxWordsPerStep: 25,
          minStepDuration: 2,
          maxStepDuration: 30,
          confidenceThreshold: 0.6
        })
        
        console.log(`✅ Created ${trainingData.steps.length} structured steps`)
        console.log(`📊 Training stats:`, trainingData.stats)
        
        // Generate GPT-enhanced steps with rewritten descriptions
        enhancedSteps = await generateGPTEnhancedSteps(videoPath, {
          useWordLevelSegmentation: false, // Use sentence-based approach
          enableGPTRewriting: true // Enable GPT rewriting for clarity
        })
        console.log(`🤖 Generated ${enhancedSteps.steps.length} GPT-enhanced steps`)
        console.log(`📊 GPT enhancement: ${enhancedSteps.summary.gptEnhanced ? 'Applied' : 'Not applied'}`)
        
        // Save the enhanced training data
        const trainingDataPath = path.join(__dirname, '../data/training', `${moduleId}.json`)
        await fs.promises.mkdir(path.dirname(trainingDataPath), { recursive: true })
        await fs.promises.writeFile(
          trainingDataPath, 
          JSON.stringify({
            moduleId,
            originalSteps: steps,
            structuredSteps: trainingData.steps,
            enhancedSteps: enhancedSteps.steps,
            stepGroups: trainingData.stepGroups,
            stats: trainingData.stats,
            transcript: trainingData.transcript,
            createdAt: new Date().toISOString()
          }, null, 2)
        )
        
        console.log(`💾 Saved training data to: ${trainingDataPath}`)
        
      } catch (transcriptionError) {
        console.error(`⚠️ Transcription processing failed: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}`)
        // Continue with original processing if transcription fails
      }

      // Save module data with the correct moduleId
      await storageService.saveModule({ ...moduleData, id: moduleId })

      // Append to modules.json with the correct moduleId
      const newModule = {
        id: moduleId,
        filename: `${moduleId}.mp4`, // Use the moduleId from storageService
        title: originalname.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
      }
      const dataPath = path.resolve(__dirname, '../data/modules.json')
      let existingModules = []
      try {
        const raw = await fs.promises.readFile(dataPath, 'utf-8')
        existingModules = JSON.parse(raw)
      } catch {
        existingModules = []
      }
      existingModules.push(newModule)
      await fs.promises.writeFile(dataPath, JSON.stringify(existingModules, null, 2))

      // Start transcription in background (fire-and-forget)
      transcribeS3Video(moduleId, `${moduleId}.mp4`)
        .then(() => console.log(`Transcript generated for ${moduleId}`))
        .catch(err => console.error(`Transcript generation failed for ${moduleId}:`, err))

      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: steps,
        // Include structured training data if available
        structuredSteps: enhancedSteps?.steps || null,
        trainingStats: trainingData?.stats || null
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: 'Upload failed' })
    }
  },
} 