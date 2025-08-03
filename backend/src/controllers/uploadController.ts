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
        const videoPath = path.join(path.resolve(__dirname, '../../'), 'uploads', `${moduleId}.mp4`)
        
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
        const trainingDataPath = path.join(path.resolve(__dirname, '../../'), 'data', 'training', `${moduleId}.json`)
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
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2))
    console.log('📦 Request headers:', req.headers['content-type'])
    
    try {
      const { moduleId, originalFilename, totalChunks } = req.body
      
      // Enhanced validation with detailed error messages
      const missingFields = []
      if (!moduleId) missingFields.push('moduleId')
      if (!originalFilename) missingFields.push('originalFilename')
      if (!totalChunks) missingFields.push('totalChunks')
      
      if (missingFields.length > 0) {
        console.error(`❌ Missing required fields: ${missingFields.join(', ')}`)
        console.error(`📦 Received body:`, req.body)
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          received: { moduleId, originalFilename, totalChunks }
        })
      }

      // Validate totalChunks is a number (handle string conversion)
      const totalChunksNum = parseInt(totalChunks.toString())
      if (isNaN(totalChunksNum) || totalChunksNum <= 0) {
        console.error(`❌ Invalid totalChunks: ${totalChunks} (type: ${typeof totalChunks})`)
        return res.status(400).json({ 
          error: 'Invalid totalChunks - must be a positive number',
          received: { totalChunks, type: typeof totalChunks }
        })
      }

      console.log(`📦 Finalizing upload for module ${moduleId} with ${totalChunksNum} chunks`)
      console.log(`📦 Original filename: ${originalFilename}`)
      console.log(`📦 Total chunks (parsed): ${totalChunksNum}`)

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
      
      // List all files in temp directory for debugging
      try {
        const tempFiles = await fs.promises.readdir(tempDir)
        console.log(`📁 Files in temp directory:`, tempFiles)
        
        // Verify we have the expected number of chunks
        const chunkFiles = tempFiles.filter(file => file.startsWith('chunk-'))
        console.log(`📦 Found ${chunkFiles.length} chunk files, expected ${totalChunksNum}`)
        
        if (chunkFiles.length !== totalChunksNum) {
          console.error(`❌ Chunk count mismatch: found ${chunkFiles.length}, expected ${totalChunksNum}`)
          return res.status(400).json({ 
            error: `Chunk count mismatch. Found ${chunkFiles.length} chunks, expected ${totalChunksNum}`,
            moduleId,
            foundChunks: chunkFiles.length,
            expectedChunks: totalChunksNum
          })
        }
      } catch (listError) {
        console.error(`❌ Error listing temp directory:`, listError)
        return res.status(500).json({ 
          error: 'Failed to read chunk directory',
          moduleId
        })
      }
      
      // Use write stream for better memory management
      console.log(`🧩 Merging chunks for module: ${moduleId}`)
      const writeStream = fs.createWriteStream(finalPath)
      let totalBytesWritten = 0
      
      return new Promise<void>((resolve, reject) => {
        writeStream.on('error', (error) => {
          console.error('❌ Write stream error:', error)
          reject(error)
        })
        
        writeStream.on('finish', async () => {
          console.log(`✅ Final video assembled at: ${finalPath}`)
          console.log(`📊 Total bytes written: ${totalBytesWritten}`)
          
          // Verify the final file exists and has content
          try {
            const stats = await fs.promises.stat(finalPath)
            console.log(`📊 Final file stats: ${stats.size} bytes`)
            
            if (stats.size === 0) {
              console.error('❌ Final file is empty after writing')
              reject(new Error('Final file is empty after writing'))
              return
            }
            
            // Clean up temp directory
            try {
              await fs.promises.rm(tempDir, { recursive: true, force: true })
              console.log(`🗑️ Cleaned up temp directory: ${tempDir}`)
            } catch (cleanupError) {
              console.warn('⚠️ Failed to clean up temp directory:', cleanupError)
            }
            
            // Create basic steps immediately (no AI dependency)
            console.log('📝 Creating basic steps data...')
            try {
              await this.createBasicSteps(moduleId, originalFilename, finalPath)
              console.log('✅ Basic steps created successfully')
            } catch (stepsError) {
              console.error('❌ Failed to create basic steps:', stepsError)
              // Continue anyway - steps can be generated later
            }
            
            resolve()
          } catch (error) {
            console.error('❌ Error verifying final file:', error)
            reject(error)
          }
        })
        
        // Write chunks sequentially
        const writeChunks = async () => {
          try {
            for (let i = 0; i < totalChunksNum; i++) {
              const chunkPath = path.join(tempDir, `chunk-${i}`)
              console.log(`📦 Writing chunk ${i} from: ${chunkPath}`)
              
              if (!fs.existsSync(chunkPath)) {
                const error = `Missing chunk file: ${chunkPath}`
                console.error(`❌ ${error}`)
                reject(new Error(error))
                return
              }
              
              const chunkBuffer = await fs.promises.readFile(chunkPath)
              console.log(`📦 Chunk ${i} size: ${(chunkBuffer.length / 1024).toFixed(2)} KB`)
              
              writeStream.write(chunkBuffer)
              totalBytesWritten += chunkBuffer.length
            }
            
            writeStream.end()
          } catch (error) {
            console.error('❌ Error writing chunks:', error)
            reject(error)
          }
        }
        
        writeChunks()
      }).then(() => {
        // Return success response
        res.json({
          success: true,
          moduleId,
          videoUrl: `http://localhost:8000/uploads/${moduleId}.mp4`,
          message: 'Upload finalized successfully. Processing started in background.',
          fileSize: totalBytesWritten
        })
      }).catch((error) => {
        console.error('❌ Finalize upload error:', error)
        res.status(500).json({ 
          error: 'Failed to finalize upload',
          details: error instanceof Error ? error.message : 'Unknown error',
          moduleId: req.body?.moduleId || 'unknown',
          totalChunks: req.body?.totalChunks || 'unknown'
        })
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
      console.log(`📁 Video file: ${videoPath}`)
      
      // Use existing imports
      const audioProcessor = new AudioProcessor()
      
      // Step 1: Generate transcript
      console.log(`🎤 Generating transcript for ${moduleId}...`)
      await transcribeS3Video(moduleId, `${moduleId}.mp4`)
      console.log(`✅ Transcript generated for ${moduleId}`)
      
      // Step 2: Generate steps from transcript
      console.log(`📝 Generating steps for ${moduleId}...`)
      const transcriptPath = path.join(path.resolve(__dirname, '../../'), 'data', 'transcripts', `${moduleId}.json`)
      const stepsPath = path.join(path.resolve(__dirname, '../../'), 'data', 'training', `${moduleId}.json`)
      
      // Ensure directories exist
      await fs.promises.mkdir(path.dirname(transcriptPath), { recursive: true })
      await fs.promises.mkdir(path.dirname(stepsPath), { recursive: true })
      
      // Read transcript
      let transcript = ''
      try {
        const transcriptData = await fs.promises.readFile(transcriptPath, 'utf-8')
        const parsed = JSON.parse(transcriptData)
        transcript = parsed.transcript || parsed.text || ''
      } catch (error) {
        console.warn(`⚠️ Could not read transcript for ${moduleId}:`, error)
        transcript = ''
      }
      
      // Generate basic steps if transcript exists
      if (transcript) {
        const steps = await audioProcessor.generateEnhancedSteps(videoPath)
        
        // Save steps
        await fs.promises.writeFile(stepsPath, JSON.stringify({
          moduleId,
          steps: steps.steps,
          transcript,
          createdAt: new Date().toISOString()
        }, null, 2))
        
        console.log(`✅ Generated ${steps.steps.length} steps for ${moduleId}`)
      } else {
        // Create empty steps file
        await fs.promises.writeFile(stepsPath, JSON.stringify({
          moduleId,
          steps: [],
          transcript: '',
          createdAt: new Date().toISOString(),
          error: 'No transcript available'
        }, null, 2))
        
        console.log(`⚠️ No transcript available for ${moduleId}, created empty steps`)
      }
      
      // Step 3: Save module data
      const moduleData = {
        id: moduleId,
        filename: `${moduleId}.mp4`,
        title: originalFilename.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
        status: 'processed',
        hasTranscript: !!transcript,
        hasSteps: true
      }
      
      await storageService.saveModule(moduleData)
      
      // Update modules.json
      const dataPath = path.join(path.resolve(__dirname, '../../'), 'data', 'modules.json')
      
      let existingModules = []
      try {
        const raw = await fs.promises.readFile(dataPath, 'utf-8')
        existingModules = JSON.parse(raw)
      } catch {
        existingModules = []
      }
      
      // Update existing module or add new one
      const existingIndex = existingModules.findIndex((m: any) => m.id === moduleId)
      if (existingIndex >= 0) {
        existingModules[existingIndex] = moduleData
      } else {
        existingModules.push(moduleData)
      }
      
      await fs.promises.writeFile(dataPath, JSON.stringify(existingModules, null, 2))
      
      console.log(`✅ Processing completed for module ${moduleId}`)
      
    } catch (error) {
      console.error(`❌ Async processing failed for module ${moduleId}:`, error)
      console.error('📋 Full error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      // Create error steps file
      try {
        const stepsPath = path.join(path.resolve(__dirname, '../../'), 'data', 'training', `${moduleId}.json`)
        await fs.promises.mkdir(path.dirname(stepsPath), { recursive: true })
        await fs.promises.writeFile(stepsPath, JSON.stringify({
          moduleId,
          steps: [],
          transcript: '',
          createdAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown processing error'
        }, null, 2))
      } catch (writeError) {
        console.error('❌ Failed to write error steps file:', writeError)
      }
    }
  },

  async createBasicSteps(moduleId: string, originalFilename: string, videoPath: string) {
    try {
      console.log(`📝 Creating basic steps for module ${moduleId}`)
      
      // Create basic steps data (no AI dependency)
      const basicSteps = [
        {
          id: 1,
          timestamp: 0,
          title: "Getting Started",
          description: "Begin following this training video",
          duration: 60
        },
        {
          id: 2,
          timestamp: 60,
          title: "Main Process",
          description: "Follow the main steps demonstrated in the video",
          duration: 120
        },
        {
          id: 3,
          timestamp: 180,
          title: "Completion",
          description: "Complete the process as shown",
          duration: 60
        }
      ]

      const stepsData = {
        moduleId,
        originalSteps: basicSteps,
        enhancedSteps: basicSteps,
        stats: {
          totalSteps: basicSteps.length,
          totalDuration: 300,
          averageStepLength: 100
        },
        videoFile: videoPath,
        originalFilename,
        createdAt: new Date().toISOString(),
        status: 'basic' // Indicates these are basic steps, not AI-enhanced
      }

      // Save steps to training directory
      const trainingDir = path.join(path.resolve(__dirname, '../../'), 'data', 'training')
      await fs.promises.mkdir(trainingDir, { recursive: true })
      const stepsPath = path.join(trainingDir, `${moduleId}.json`)
      await fs.promises.writeFile(stepsPath, JSON.stringify(stepsData, null, 2))
      
      console.log(`✅ Basic steps saved to: ${stepsPath}`)

      // Update modules.json
      const modulesPath = path.join(path.resolve(__dirname, '../../'), 'data', 'modules.json')
      let existingModules = []
      try {
        const raw = await fs.promises.readFile(modulesPath, 'utf-8')
        existingModules = JSON.parse(raw)
      } catch {
        existingModules = []
      }
      
      const newModule = {
        id: moduleId,
        filename: `${moduleId}.mp4`,
        title: originalFilename.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
        status: 'ready',
        hasSteps: true,
        stepType: 'basic'
      }
      
      // Remove existing module if it exists
      existingModules = existingModules.filter((m: any) => m.id !== moduleId)
      existingModules.push(newModule)
      
      await fs.promises.writeFile(modulesPath, JSON.stringify(existingModules, null, 2))
      
      console.log('✅ Module added to modules.json')
      
    } catch (error) {
      console.error(`❌ Failed to create basic steps for ${moduleId}:`, error)
      throw error
    }
  }
} 