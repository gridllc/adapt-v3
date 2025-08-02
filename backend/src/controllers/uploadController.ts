import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
import { AudioProcessor } from '../services/audioProcessor.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { transcribeS3Video } from '../services/transcriptionService.js'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    console.log('🔁 Upload handler triggered')
    
    try {
      if (!req.file) {
        console.error('❌ No file uploaded')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      console.log('📦 File uploaded:', req.file.originalname)
      console.log('📦 File size:', req.file.size, 'bytes')
      console.log('📦 File mimetype:', req.file.mimetype)

      const file = req.file
      const originalname = file.originalname

      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      console.log('💾 Starting storage upload...')
      // Upload to storage and get the moduleId that was actually used
      const { moduleId, videoUrl } = await storageService.uploadVideo(file)
      console.log('✅ Storage upload completed:', { moduleId, videoUrl })

      console.log('🤖 Starting AI processing...')
      // Process with AI using the actual video URL
      const moduleData = await aiService.processVideo(videoUrl)
      console.log('✅ AI processing completed')

      console.log('📋 Starting steps generation...')
      // Generate and save steps for the module
      const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
      console.log('✅ Steps generation completed:', steps.length, 'steps')

      console.log('🎯 Starting transcription processing...')
      // NEW: Create structured training steps from transcription
      let trainingData: any = null;
      let enhancedSteps: any = null;
      try {
        console.log(`🎯 Creating structured training steps for module: ${moduleId}`)
        
        // Get the actual video file path - use the same path as storageService
        const videoPath = path.join(path.resolve(__dirname, '../../..'), 'backend', 'uploads', `${moduleId}.mp4`)
        
        // Debug: Check if file exists
        const fs = await import('fs')
        if (!fs.existsSync(videoPath)) {
          console.error(`❌ Video file not found: ${videoPath}`)
          throw new Error(`Video file not found: ${videoPath}`)
        }
        console.log(`✅ Video file found: ${videoPath}`)
        
        // Create AudioProcessor instance
        const audioProcessor = new AudioProcessor()
        
        // Create structured training steps with enhanced formatting
        trainingData = await audioProcessor.createTrainingStepsFromVideo(videoPath, {
          maxWordsPerStep: 25,
          minStepDuration: 2,
          maxStepDuration: 30,
          confidenceThreshold: 0.6
        })
        
        console.log(`✅ Created ${trainingData.steps.length} structured steps`)
        console.log(`📊 Training stats:`, trainingData.stats)
        
        // Generate GPT-enhanced steps with rewritten descriptions
        enhancedSteps = await audioProcessor.generateGPTEnhancedSteps(videoPath, {
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
        console.error('📋 Full transcription error:', transcriptionError)
        // Continue with original processing if transcription fails
      }

      console.log('💾 Saving module data...')
      // Save module data with the correct moduleId
      await storageService.saveModule({ ...moduleData, id: moduleId })
      console.log('✅ Module data saved')

      console.log('📝 Updating modules.json...')
      // Append to modules.json with the correct moduleId
      const newModule = {
        id: moduleId,
        filename: `${moduleId}.mp4`, // Use the moduleId from storageService
        title: originalname.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
      }
      // Handle both development and production paths
    const isProduction = process.env.NODE_ENV === 'production'
    const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')
    const dataPath = path.join(baseDir, 'data', 'modules.json')
      let existingModules = []
      try {
        const raw = await fs.promises.readFile(dataPath, 'utf-8')
        existingModules = JSON.parse(raw)
      } catch {
        existingModules = []
      }
      existingModules.push(newModule)
      await fs.promises.writeFile(dataPath, JSON.stringify(existingModules, null, 2))
      console.log('✅ modules.json updated')

      console.log('🎤 Starting background transcription...')
      // Start transcription in background (fire-and-forget)
      transcribeS3Video(moduleId, `${moduleId}.mp4`)
        .then(() => console.log(`Transcript generated for ${moduleId}`))
        .catch(err => console.error(`Transcript generation failed for ${moduleId}:`, err))

      console.log('📤 Sending response to client...')
      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: steps,
        // Include structured training data if available
        structuredSteps: enhancedSteps?.steps || null,
        trainingStats: trainingData?.stats || null
      })
      console.log('✅ Upload completed successfully')
    } catch (error) {
      console.error('❌ Upload error:', error)
      console.error('📋 Full error stack:', error instanceof Error ? error.stack : 'No stack trace')
      res.status(500).json({ error: 'Upload failed' })
    }
  },

  async uploadChunk(req: Request, res: Response) {
    console.log('🔁 Chunk upload handler triggered')
    
    try {
      if (!req.file) {
        console.error('❌ No chunk uploaded')
        return res.status(400).json({ error: 'No chunk uploaded' })
      }

      const { chunkIndex, totalChunks, moduleId } = req.body
      
      if (!chunkIndex || !totalChunks || !moduleId) {
        return res.status(400).json({ error: 'Missing required fields: chunkIndex, totalChunks, moduleId' })
      }

      console.log(`📦 Chunk ${chunkIndex}/${totalChunks} uploaded for module ${moduleId}`)
      console.log(`📦 Chunk size: ${req.file.size} bytes`)

      // Create temp directory for chunks
      const tempDir = path.join(process.cwd(), 'uploads', 'temp', moduleId)
      await fs.promises.mkdir(tempDir, { recursive: true })

      // Save chunk to temp directory
      const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`)
      await fs.promises.writeFile(chunkPath, req.file.buffer)

      console.log(`✅ Chunk ${chunkIndex} saved to ${chunkPath}`)

      res.json({ 
        success: true, 
        chunkIndex: parseInt(chunkIndex),
        message: `Chunk ${chunkIndex} uploaded successfully` 
      })

    } catch (error) {
      console.error('❌ Chunk upload error:', error)
      res.status(500).json({ error: 'Chunk upload failed' })
    }
  },

  async finalizeUpload(req: Request, res: Response) {
    console.log('🔁 Finalize upload handler triggered')
    
    try {
      const { moduleId, originalFilename, totalChunks } = req.body
      
      if (!moduleId || !originalFilename || !totalChunks) {
        return res.status(400).json({ error: 'Missing required fields: moduleId, originalFilename, totalChunks' })
      }

      console.log(`📦 Finalizing upload for module ${moduleId} with ${totalChunks} chunks`)

      // Reassemble chunks
      const tempDir = path.join(process.cwd(), 'uploads', 'temp', moduleId)
      const finalPath = path.join(process.cwd(), 'uploads', `${moduleId}.mp4`)
      
      const fileBuffers: Buffer[] = []
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk-${i}`)
        const chunkBuffer = await fs.promises.readFile(chunkPath)
        fileBuffers.push(chunkBuffer)
      }

      // Combine all chunks
      const fullFile = Buffer.concat(fileBuffers)
      await fs.promises.writeFile(finalPath, fullFile)

      console.log(`✅ File reassembled: ${finalPath}`)
      console.log(`📊 Final file size: ${(fullFile.length / 1024 / 1024).toFixed(2)} MB`)

      // Clean up temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true })
        console.log(`🗑️ Cleaned up temp directory: ${tempDir}`)
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up temp directory:', cleanupError)
      }

      // Start async processing
      console.log('🤖 Starting async AI processing...')
      this.processVideoAsync(moduleId, originalFilename, finalPath)

      res.json({
        success: true,
        moduleId,
        videoUrl: `http://localhost:8000/uploads/${moduleId}.mp4`,
        message: 'Upload finalized successfully. Processing started in background.'
      })

    } catch (error) {
      console.error('❌ Finalize upload error:', error)
      res.status(500).json({ error: 'Failed to finalize upload' })
    }
  },

  async processVideoAsync(moduleId: string, originalFilename: string, videoPath: string) {
    try {
      console.log(`🤖 Starting async processing for module ${moduleId}`)
      
      // Process with AI
      const videoUrl = `http://localhost:8000/uploads/${moduleId}.mp4`
      const moduleData = await aiService.processVideo(videoUrl)
      
      // Generate steps
      const steps = await aiService.generateStepsForModule(moduleId, videoUrl)
      
      // Transcription processing
      let trainingData: any = null
      let enhancedSteps: any = null
      
      try {
        const audioProcessor = new AudioProcessor()
        
        trainingData = await audioProcessor.createTrainingStepsFromVideo(videoPath, {
          maxWordsPerStep: 25,
          minStepDuration: 2,
          maxStepDuration: 30,
          confidenceThreshold: 0.6
        })
        
        enhancedSteps = await audioProcessor.generateGPTEnhancedSteps(videoPath, {
          useWordLevelSegmentation: false,
          enableGPTRewriting: true
        })
        
        // Save training data
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
        
      } catch (transcriptionError) {
        console.error(`⚠️ Async transcription failed for ${moduleId}:`, transcriptionError)
      }

      // Save module data
      await storageService.saveModule({ ...moduleData, id: moduleId })
      
      // Update modules.json
      const isProduction = process.env.NODE_ENV === 'production'
      const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')
      const dataPath = path.join(baseDir, 'data', 'modules.json')
      
      let existingModules = []
      try {
        const raw = await fs.promises.readFile(dataPath, 'utf-8')
        existingModules = JSON.parse(raw)
      } catch {
        existingModules = []
      }
      
      const newModule = {
        id: moduleId,
        filename: `${moduleId}.mp4`,
        title: originalFilename.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
      }
      
      existingModules.push(newModule)
      await fs.promises.writeFile(dataPath, JSON.stringify(existingModules, null, 2))
      
      // Start background transcription
      transcribeS3Video(moduleId, `${moduleId}.mp4`)
        .then(() => console.log(`Async transcript generated for ${moduleId}`))
        .catch(err => console.error(`Async transcript generation failed for ${moduleId}:`, err))
      
      console.log(`✅ Async processing completed for module ${moduleId}`)
      
    } catch (error) {
      console.error(`❌ Async processing failed for module ${moduleId}:`, error)
    }
  }
} 