import { Request, Response } from 'express'
import { storageService } from '../services/storageService.js'

export const moduleController = {
  async getAllModules(req: Request, res: Response) {
    try {
      console.log('=== GET ALL MODULES ===')
      
      // Use storageService to get modules (database or mock)
      const modules = await storageService.getAllModules()
      
      console.log(`✅ Returning ${modules.length} modules`)
      res.json({ success: true, modules })
    } catch (error) {
      console.error('💥 Get modules error:', error)
      res.status(500).json({ error: 'Failed to get modules' })
    }
  },

  async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params
      console.log(`📖 Getting module by ID: ${id}`)
      
      // Get module from database
      const { DatabaseService } = await import('../services/prismaService.js')
      const module = await DatabaseService.getModule(id)
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }
      
      // Get steps from S3 if module is READY
      let steps = []
      let transcriptText = ''
      
      if (module.status === 'READY') {
        try {
          const { storageService } = await import('../services/storageService.js')
          const stepsKey = `training/${id}.json`
          const stepsData = await storageService.getJson(stepsKey)
          
          if (stepsData) {
            steps = stepsData.steps || []
            transcriptText = stepsData.transcript || ''
            console.log(`✅ Loaded ${steps.length} steps and transcript for module ${id}`)
          }
        } catch (stepsError) {
          console.warn(`⚠️ Failed to load steps for module ${id}:`, stepsError)
        }
      }
      
      // Generate signed video URL if module has s3Key
      let videoUrl = null
      if (module.s3Key) {
        try {
          const { presignedUploadService } = await import('../services/presignedUploadService.js')
          videoUrl = await presignedUploadService.getSignedPlaybackUrl(module.s3Key)
        } catch (urlError) {
          console.warn(`⚠️ Failed to generate video URL for module ${id}:`, urlError)
        }
      }
      
      const response = {
        success: true,
        module: {
          ...module,
          videoUrl,
          steps,
          transcriptText
        }
      }
      
      console.log(`✅ Returning module ${id} with ${steps.length} steps`)
      res.json(response)
      
    } catch (error) {
      console.error('Get module error:', error)
      res.status(500).json({ error: 'Failed to get module' })
    }
  },

  async updateModule(req: Request, res: Response) {
    try {
      const { id } = req.params
      console.log('=== UPDATE MODULE ===', id)
      res.json({ success: true, id })
    } catch (error) {
      console.error('💥 Update module error:', error)
      res.status(500).json({ error: 'Failed to update module' })
    }
  },

  async deleteModule(req: Request, res: Response) {
    try {
      const { id } = req.params
      console.log('=== DELETE MODULE ===', id)
      res.json({ success: true, id })
    } catch (error) {
      console.error('💥 Delete module error:', error)
      res.status(500).json({ error: 'Failed to delete module' })
    }
  },
} 