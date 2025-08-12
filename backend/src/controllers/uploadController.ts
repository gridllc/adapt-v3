import { Request, Response } from 'express'
import { storageService } from '../services/storageService.js'
import { createBasicSteps } from '../services/createBasicSteps.js'
import { aiService } from '../services/aiService.js'
import { ModuleService } from '../services/moduleService.js'

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    try {
      console.log('=== UPLOAD CONTROLLER HIT ===')
      console.log('Method:', req.method)
      console.log('Headers:', req.headers)
      console.log('Body keys:', Object.keys(req.body || {}))
      console.log('File:', req.file ? 'FILE PRESENT' : 'NO FILE')

      if (!req.file) {
        console.log('ERROR: No file in request')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const file = req.file
      console.log('File details:', {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      })
      
      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        console.log('ERROR: Invalid file type')
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      console.log('✅ File validated successfully')

      // Additional file integrity check
      console.log('🔍 File integrity check:', {
        size: file.size,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        bufferLength: file.buffer?.length || 0,
        bufferValid: file.buffer && file.buffer.length > 0
      })

      // Check if file is too small (likely corrupted)
      if (file.size < 1000) { // Less than 1KB
        console.error('❌ File too small, likely corrupted:', file.size)
        return res.status(400).json({ 
          error: 'File appears to be corrupted or incomplete',
          size: file.size 
        })
      }

      // Upload video using storageService (S3 or mock)
      console.log('🚀 Starting video upload...')
      const videoUrl = await storageService.uploadVideo(file)
      console.log('✅ Video upload completed:', videoUrl)

      // Verify S3 upload was successful
      if (videoUrl.includes('localhost:8000')) {
        console.log('⚠️ Using mock storage, skipping AI processing')
        // Return success without AI processing for mock storage
        const response = {
          success: true,
          moduleId: `mock_${Date.now()}`,
          videoUrl: videoUrl,
          steps: [
            { id: 1, timestamp: 0, title: 'Mock Step', description: 'Development mode', duration: 30 }
          ],
          status: 'completed',
          message: 'Video uploaded to mock storage (AI processing disabled)'
        }
        return res.json(response)
      }

      // Verify S3 file is accessible
      try {
        console.log('🔍 Verifying S3 file accessibility...')
        const response = await fetch(videoUrl, { method: 'HEAD' })
        if (!response.ok) {
          throw new Error(`S3 file not accessible: ${response.status}`)
        }
        console.log('✅ S3 file verified and accessible')
      } catch (error) {
        console.error('❌ S3 file verification failed:', error)
        return res.status(500).json({ 
          error: 'S3 upload verification failed',
          message: 'File uploaded but not accessible for processing'
        })
      }

      // Create module data
      const moduleData = {
        title: file.originalname.replace(/\.[^/.]+$/, ''), // Remove file extension
        filename: file.originalname,
        videoUrl: videoUrl,
        steps: [
          { id: 1, timestamp: 0, title: 'Introduction', description: 'Getting started', duration: 30 },
          { id: 2, timestamp: 30, title: 'Main content', description: 'Core training', duration: 60 },
          { id: 3, timestamp: 90, title: 'Conclusion', description: 'Wrapping up', duration: 20 }
        ],
      }

      // Save module using storageService (database or mock)
      console.log('💾 Saving module data...')
      const moduleId = await storageService.saveModule(moduleData)
      console.log('✅ Module saved:', moduleId)

      // 🚀 CRITICAL: Trigger AI processing pipeline DIRECTLY
      console.log('🤖 Starting AI processing pipeline...')
      
      try {
        // 1. Create basic step files to prevent "Steps not found" errors
        console.log('📝 Creating basic step files...')
        await createBasicSteps(moduleId, file.originalname)
        console.log('✅ Basic step files created')

        // 2. Update module status to processing
        console.log('🔄 Updating module status to processing...')
        await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Starting AI analysis...')
        console.log('✅ Module status updated to processing')

        // 3. Start AI processing in background (don't await - let it run async)
        console.log('🧠 Starting AI processing in background...')
        aiService.generateStepsForModule(moduleId, videoUrl)
          .then(async (steps) => {
            console.log(`✅ AI processing completed for ${moduleId}, generated ${steps?.length || 0} steps`)
            
            if (steps && Array.isArray(steps)) {
              // Update progress to 100% and status to ready
              await ModuleService.updateModuleStatus(moduleId, 'ready', 100, 'AI processing complete!')
              console.log(`🎉 Module ${moduleId} is now ready with ${steps.length} steps`)
            } else {
              throw new Error('AI processing returned invalid steps')
            }
          })
          .catch(async (error) => {
            console.error(`❌ AI processing failed for ${moduleId}:`, error)
            await ModuleService.updateModuleStatus(moduleId, 'failed', 0, `AI processing failed: ${error.message}`)
          })

        console.log('✅ AI processing job started in background')

      } catch (processingError) {
        console.error('⚠️ AI processing setup failed, but upload succeeded:', processingError)
        // Don't fail the upload if AI processing setup fails
        // The user can still view the video, just without AI-generated steps
      }

      const response = {
        success: true,
        moduleId: moduleId,
        videoUrl: videoUrl,
        steps: moduleData.steps,
        status: 'processing', // Indicate that AI processing is happening
        message: 'Video uploaded successfully. AI processing started...'
      }

      console.log('✅ Returning success response:', response)
      res.json(response)

    } catch (error) {
      console.error('💥 Upload controller error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      res.status(500).json({ 
        error: 'Upload failed',
        message: errorMessage,
        stack: errorStack 
      })
    }
  },
}
