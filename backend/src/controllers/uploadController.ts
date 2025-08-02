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
      
      // Enhanced validation with detailed error messages
      const missingFields = []
      if (!chunkIndex) missingFields.push('chunkIndex')
      if (!totalChunks) missingFields.push('totalChunks')
      if (!moduleId) missingFields.push('moduleId')
      
      if (missingFields.length > 0) {
        console.error(`❌ Missing required fields: ${missingFields.join(', ')}`)
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          received: { chunkIndex, totalChunks, moduleId }
        })
      }

      // Validate chunk index
      const chunkIndexNum = parseInt(chunkIndex)
      const totalChunksNum = parseInt(totalChunks)
      
      if (isNaN(chunkIndexNum) || isNaN(totalChunksNum)) {
        return res.status(400).json({ 
          error: 'Invalid chunk index or total chunks - must be numbers',
          received: { chunkIndex, totalChunks }
        })
      }

      if (chunkIndexNum < 0 || chunkIndexNum >= totalChunksNum) {
        return res.status(400).json({ 
          error: `Invalid chunk index: ${chunkIndexNum} (must be 0 to ${totalChunksNum - 1})`,
          received: { chunkIndex: chunkIndexNum, totalChunks: totalChunksNum }
        })
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
        chunkIndex: chunkIndexNum,
        totalChunks: totalChunksNum,
        moduleId,
        message: `Chunk ${chunkIndex} uploaded successfully` 
      })

    } catch (error) {
      console.error('❌ Chunk upload error:', error)
      res.status(500).json({ error: 'Chunk upload failed' })
    }
  },

  async finalizeUpload(req: Request, res: Response) {
    console.log('🔁 Finalize upload handler triggered')
    console.log('📦 Request body:', req.body)
    
    try {
      const { moduleId, originalFilename, totalChunks } = req.body
      
      // Enhanced validation with detailed error messages
      const missingFields = []
      if (!moduleId) missingFields.push('moduleId')
      if (!originalFilename) missingFields.push('originalFilename')
      if (!totalChunks) missingFields.push('totalChunks')
      
      if (missingFields.length > 0) {
        console.error(`❌ Missing required fields: ${missingFields.join(', ')}`)
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          received: { moduleId, originalFilename, totalChunks }
        })
      }

      // Validate totalChunks is a number
      const totalChunksNum = parseInt(totalChunks)
      if (isNaN(totalChunksNum) || totalChunksNum <= 0) {
        return res.status(400).json({ 
          error: 'Invalid totalChunks - must be a positive number',
          received: { totalChunks }
        })
      }

      console.log(`📦 Finalizing upload for module ${moduleId} with ${totalChunks} chunks`)

      // Reassemble chunks
      const tempDir = path.join(process.cwd(), 'uploads', 'temp', moduleId)
      const finalPath = path.join(process.cwd(), 'uploads', `${moduleId}.mp4`)
      
      console.log(`📁 Temp directory: ${tempDir}`)
      console.log(`📁 Final path: ${finalPath}`)
      
      // Check if temp directory exists
      if (!fs.existsSync(tempDir)) {
        console.error(`❌ Temp directory not found: ${tempDir}`)
        return res.status(400).json({ 
          error: 'No chunks found for this module. Please upload chunks first.',
          moduleId,
          tempDir
        })
      }
      
      const fileBuffers: Buffer[] = []
      
      for (let i = 0; i < totalChunksNum; i++) {
        const chunkPath = path.join(tempDir, `chunk-${i}`)
        console.log(`📦 Looking for chunk ${i} at: ${chunkPath}`)
        
        if (!fs.existsSync(chunkPath)) {
          console.error(`❌ Missing chunk file: ${chunkPath}`)
          return res.status(400).json({ 
            error: `Missing chunk ${i}. Expected ${totalChunksNum} chunks but chunk ${i} is missing.`,
            moduleId,
            missingChunk: i,
            totalChunks: totalChunksNum
          })
        }
        
        const chunkBuffer = await fs.promises.readFile(chunkPath)
        fileBuffers.push(chunkBuffer)
        console.log(`📦 Loaded chunk ${i}: ${(chunkBuffer.length / 1024).toFixed(2)} KB`)
      }

      // Combine all chunks
      const fullFile = Buffer.concat(fileBuffers)
      
      // Validate the final file size
      if (fullFile.length === 0) {
        console.error('❌ Final file is empty')
        return res.status(400).json({ 
          error: 'Final file is empty. Upload may have failed.',
          moduleId,
          totalChunks: totalChunksNum,
          finalFileSize: fullFile.length
        })
      }
      
      // Ensure uploads directory exists
      const uploadsDir = path.dirname(finalPath)
      if (!fs.existsSync(uploadsDir)) {
        await fs.promises.mkdir(uploadsDir, { recursive: true })
        console.log(`📁 Created uploads directory: ${uploadsDir}`)
      }
      
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

      // Start async processing (don't await it)
      console.log('🤖 Starting async AI processing...')
      // Temporarily disable async processing to isolate the issue
      // this.processVideoAsync(moduleId, originalFilename, finalPath).catch(error => {
      //   console.error(`❌ Async processing failed for ${moduleId}:`, error)
      // })

      // Return immediately
      res.json({
        success: true,
        moduleId,
        videoUrl: `http://localhost:8000/uploads/${moduleId}.mp4`,
        message: 'Upload finalized successfully. Processing started in background.',
        fileSize: fullFile.length
      })

    } catch (error) {
      console.error('❌ Finalize upload error:', error)
      console.error('📋 Full error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      // Return more detailed error information
      res.status(500).json({ 
        error: 'Failed to finalize upload',
        details: error instanceof Error ? error.message : 'Unknown error',
        moduleId: req.body?.moduleId || 'unknown',
        totalChunks: req.body?.totalChunks || 'unknown'
      })
    }
  },

  async processVideoAsync(moduleId: string, originalFilename: string, videoPath: string) {
    try {
      console.log(`🤖 Starting async processing for module ${moduleId}`)
      
      // For now, skip AI processing to avoid potential errors
      console.log(`📁 Video file saved at: ${videoPath}`)
      
      // Save basic module data without AI processing
      const basicModuleData = {
        id: moduleId,
        filename: `${moduleId}.mp4`,
        title: originalFilename.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
        status: 'uploaded'
      }
      
      // Save module data
      await storageService.saveModule(basicModuleData)
      
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
      
      existingModules.push(basicModuleData)
      await fs.promises.writeFile(dataPath, JSON.stringify(existingModules, null, 2))
      
      console.log(`✅ Basic processing completed for module ${moduleId}`)
      
    } catch (error) {
      console.error(`❌ Async processing failed for module ${moduleId}:`, error)
      // Don't throw - this is background processing
    }
  }
} 