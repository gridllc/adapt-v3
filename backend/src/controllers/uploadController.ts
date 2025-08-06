import { Request, Response } from 'express'
import { storageService } from '../services/storageService.js'
import { enqueueProcessVideoJob, perfLogger } from '../services/qstashQueue.js'
import { createBasicSteps } from '../services/createBasicSteps.js'
import { DatabaseService } from '../services/prismaService.js'
import { ModuleService } from '../services/moduleService.js'
import { UserService } from '../services/userService.js'

export const uploadController = {
  async uploadVideo(req: Request, res: Response) {
    console.log('🔁 Upload handler triggered')
    
    try {
      if (!req.file) {
        console.error('❌ No file uploaded')
        return res.status(400).json({ error: 'No file uploaded' })
      }

      console.log('[TEST] 📁 Upload started:', req.file.originalname)
      console.log('[TEST] 📁 File size:', req.file.size, 'bytes')
      console.log('[TEST] 📁 File mimetype:', req.file.mimetype)

      const file = req.file
      const originalname = file.originalname

      // Validate file
      if (!file.mimetype.startsWith('video/')) {
        return res.status(400).json({ error: 'Only video files are allowed' })
      }

      perfLogger.startUpload(file.originalname)

      console.log('[TEST] 📁 Saving to storage...')
      // Upload to storage and get the moduleId that was actually used
      const { moduleId, videoUrl } = await storageService.uploadVideo(file)
      console.log('[TEST] 📁 Module ID:', moduleId)
      console.log('[TEST] 📁 Video URL:', videoUrl)

      perfLogger.logUploadComplete(moduleId)

      // CRITICAL: Don't create DB entry until video is saved successfully
      // This ensures we never have orphaned DB records without actual video files
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
        await ModuleService.updateModuleStatus(moduleId, 'processing', 0, 'Upload complete, starting AI processing...')
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
        console.warn(`⚠️ CRITICAL: Basic steps fallback failed for ${moduleId} - module may 404 until AI completes`)
        console.warn(`⚠️ Users visiting /training/${moduleId} will see loading state until AI processing finishes`)
        // Continue anyway - the background processing will handle this, but UX will be degraded
      }

      // Queue AI processing job (async - don't wait!)
      console.log('🚀 Queuing AI processing job...')
      try {
        const job = await enqueueProcessVideoJob({
          moduleId,
          videoUrl,
        })
        console.log('✅ AI processing job queued successfully with job ID:', job?.id || 'unknown')
      } catch (error) {
        console.error('❌ Failed to queue AI processing job:', error)
        // Update status to indicate failure
        try {
          await ModuleService.updateModuleStatus(moduleId, 'failed', 0, 'Failed to start AI processing')
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
        totalDuration: 0, // Will be calculated from steps later
        fallbackStepsUrl: `/training/${moduleId}.json`, // Frontend can load basic training info immediately
        trainingUrl: `/training/${moduleId}` // Direct link to training page
      })
      console.log('✅ Upload response sent - AI processing continues in background')

    } catch (error) {
      console.error('❌ Upload error:', error)
      console.error('📋 Full error stack:', error instanceof Error ? error.stack : 'No stack trace')
      res.status(500).json({ error: 'Upload failed' })
    }
  }
} 