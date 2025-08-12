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

      // Upload video using storageService (S3 or mock)
      console.log('🚀 Starting video upload...')
      const videoUrl = await storageService.uploadVideo(file)
      console.log('✅ Video upload completed:', videoUrl)

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
