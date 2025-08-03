import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
import { AudioProcessor } from '../services/audioProcessor.js'
import { jobQueue, perfLogger } from '../services/jobQueue.js'
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

      // Create initial module entry with processing status
      const newModule = {
        id: moduleId,
        filename: `${moduleId}.mp4`,
        title: originalname.replace(/\.[^/.]+$/, ''),
        createdAt: new Date().toISOString(),
        status: 'processing',
        progress: 0,
        message: 'Upload complete, starting AI processing...'
      }
      
      // Save to modules.json
      const modulesPath = path.join(process.cwd(), 'data', 'modules.json')
      await fs.promises.mkdir(path.dirname(modulesPath), { recursive: true })
      
      let existingModules = []
      try {
        const raw = await fs.promises.readFile(modulesPath, 'utf-8')
        existingModules = JSON.parse(raw)
      } catch {
        existingModules = []
      }
      
      existingModules.push(newModule)
      await fs.promises.writeFile(modulesPath, JSON.stringify(existingModules, null, 2))
      console.log('✅ Module entry created with processing status')

      // Queue AI processing job (async - don't wait!)
      console.log('🚀 Queuing AI processing job...')
      await jobQueue.add('process-video', {
        moduleId,
        videoUrl,
      })
      console.log('✅ AI processing job queued successfully')

      // Return immediately - don't wait for AI processing!
      console.log('📤 Sending immediate response to client...')
      res.status(201).json({
        success: true,
        moduleId,
        videoUrl,
        status: 'processing',
        message: 'Upload complete! AI processing has started in the background.'
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
      const { moduleId } = req.params
      
      // Read from modules.json
      const modulesPath = path.join(process.cwd(), 'data', 'modules.json')
      let modules = []
      
      try {
        const raw = await fs.promises.readFile(modulesPath, 'utf-8')
        modules = JSON.parse(raw)
      } catch {
        return res.status(404).json({ error: 'Module not found' })
      }
      
      const module = modules.find((m: any) => m.id === moduleId)
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }

      res.json({
        status: module.status || 'processing',
        progress: module.progress || 0,
        message: module.message || '',
        steps: module.steps || [],
        error: module.error || null,
        title: module.title || '',
        description: module.description || '',
        totalDuration: module.totalDuration || 0
      })
    } catch (error) {
      console.error('Status check error:', error)
      res.status(500).json({ error: 'Status check failed' })
    }
  }
} 