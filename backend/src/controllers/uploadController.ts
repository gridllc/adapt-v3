import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
import { AudioProcessor } from '../services/audioProcessor.js'
import { jobQueue, perfLogger } from '../services/jobQueue.js'
import { createBasicSteps, updateTrainingData } from '../services/createBasicSteps.js'
import { DatabaseService } from '../services/prismaService.js'
import { UserService } from '../services/userService.js'
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

      perfLogger.startUpload(file.originalname)

      console.log('💾 Starting storage upload...')
      // Upload to storage and get the moduleId that was actually used
      const { moduleId, videoUrl } = await storageService.uploadVideo(file)
      console.log('✅ Storage upload completed:', { moduleId, videoUrl })

      perfLogger.logUploadComplete(moduleId)

      // Create initial module entry in database
      const title = originalname.replace(/\.[^/.]+$/, '')
      
      // Get user ID if authenticated (optional for now)
      const userId = await UserService.getUserIdFromRequest(req)
      
      try {
        await DatabaseService.createModule({
          id: moduleId,
          title,
          filename: `${moduleId}.mp4`,
          videoUrl,
          userId: userId || undefined
        })
        
        // Update status to processing
        await DatabaseService.updateModuleStatus(moduleId, 'processing', 0, 'Upload complete, starting AI processing...')
        console.log('✅ Module entry created in database with processing status')
        
        // Log activity
        await DatabaseService.createActivityLog({
          userId: userId || undefined,
          action: 'CREATE_MODULE',
          targetId: moduleId,
          metadata: { 
            title,
            filename: `${moduleId}.mp4`,
            videoUrl 
          }
        })
      } catch (error) {
        console.error('❌ Failed to create module in database:', error)
        return res.status(500).json({ error: 'Failed to save module data' })
      }

      // 🔴 CRITICAL FIX: Create basic step files immediately using new service
      console.log('📝 Creating basic step files...')
      try {
        await createBasicSteps(moduleId, originalname)
        console.log('✅ Basic step files created')
      } catch (error) {
        console.error('❌ Failed to create basic step files:', error)
        // Continue anyway - the background processing will handle this
      }

      // Queue AI processing job (async - don't wait!)
      console.log('🚀 Queuing AI processing job...')
      try {
        const job = await jobQueue.add('process-video', {
          moduleId,
          videoUrl,
        })
        console.log('✅ AI processing job queued successfully with job ID:', job.id)
      } catch (error) {
        console.error('❌ Failed to queue AI processing job:', error)
        // Update status to indicate failure
        try {
          await DatabaseService.updateModuleStatus(moduleId, 'error', 0, 'Failed to start AI processing')
        } catch (updateError) {
          console.error('❌ Failed to update module status:', updateError)
        }
      }

      // Return immediately - don't wait for AI processing!
      console.log('📤 Sending immediate response to client...')
      res.status(201).json({
        success: true,
        moduleId,
        videoUrl,
        title,
        status: 'processing',
        message: 'Upload complete! AI processing has started in the background.',
        totalDuration: 0 // Will be calculated from steps later
      })
      console.log('✅ Upload response sent - AI processing continues in background')

    } catch (error) {
      console.error('❌ Upload error:', error)
      console.error('📋 Full error stack:', error instanceof Error ? error.stack : 'No stack trace')
      res.status(500).json({ error: 'Upload failed' })
    }
  },

  // New endpoint for checking processing status
  async getModuleStatus(req: Request, res: Response) {
    try {
      const moduleId = req.params.moduleId as string
      
      // Get module from database
      const module = await DatabaseService.getModule(moduleId)
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }

      // Get latest status
      const latestStatus = module.statuses?.[0] || {
        status: 'processing',
        progress: 0,
        message: 'Processing started'
      }
      
      // Calculate total duration from steps
      const totalDuration = (module.steps || []).reduce(
        (acc: number, step: any) => acc + (step.duration || 0), 
        0
      )
      
      res.json({
        status: module.status || 'processing',
        progress: module.progress || 0,
        message: latestStatus?.message || '',
        steps: module.steps || [],
        error: module.status === 'error' ? latestStatus?.message || 'Processing failed' : null,
        title: module.title || '',
        description: (module as any)?.description || '', // Will be populated from AI processing when schema is updated
        totalDuration
      })
    } catch (error) {
      console.error('Status check error:', error)
      res.status(500).json({ error: 'Status check failed' })
    }
  }
} 