import { Request, Response } from 'express'
import { aiService } from '../services/aiService.js'
import { storageService } from '../services/storageService.js'
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

      // Upload to storage
      const videoUrl = await storageService.uploadVideo(file)

      // Process with AI
      const moduleData = await aiService.processVideo(videoUrl)

      // Save module
      const moduleId = await storageService.saveModule(moduleData)

      // Append to modules.json
      const newModule = {
        id: moduleId,
        filename: file.filename || `${moduleId}.mp4`,
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
      transcribeS3Video(moduleId, file.filename || `${moduleId}.mp4`)
        .then(() => console.log(`Transcript generated for ${moduleId}`))
        .catch(err => console.error(`Transcript generation failed for ${moduleId}:`, err))

      res.json({
        success: true,
        moduleId,
        videoUrl,
        steps: moduleData.steps,
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: 'Upload failed' })
    }
  },
} 