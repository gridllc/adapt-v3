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
      const { ModuleService } = await import('../services/moduleService.js')
      const module = await ModuleService.get(id)
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }
      
      // Get steps from S3 if module is READY
      let steps = []
      let transcriptText = ''
      
      console.log(`🔍 Module ${id} status: ${module.status}`)
      
      if (module.status === 'READY') {
        try {
          const { storageService } = await import('../services/storageService.js')
          const stepsKey = `training/${id}.json`
          console.log(`📂 Attempting to load steps from S3 key: ${stepsKey}`)
          
          const stepsData = await storageService.getJson(stepsKey)
          
          if (stepsData) {
            steps = stepsData.steps || []
            transcriptText = stepsData.transcript || ''
            console.log(`✅ Loaded ${steps.length} steps and transcript (${transcriptText.length} chars) for module ${id}`)
            console.log(`📋 Step preview:`, steps.slice(0, 2).map((s: any) => ({ id: s.id, text: s.text?.substring(0, 50) })))
          } else {
            console.warn(`⚠️ No steps data found in S3 for key: ${stepsKey}`)
          }
        } catch (stepsError) {
          console.error(`❌ Failed to load steps for module ${id}:`, stepsError)
        }
      } else {
        console.log(`⏳ Module ${id} not ready yet, status: ${module.status}`)
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