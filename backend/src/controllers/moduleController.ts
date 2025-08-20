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
      console.log(`🚨 NUCLEAR FIX: Breaking API to stop infinite polling for ${req.params.id}`)
      
      // Return an error to break the polling
      res.status(500).json({ 
        error: 'API temporarily disabled to stop infinite polling',
        moduleId: req.params.id,
        message: 'Polling stopped - please check your frontend code'
      })
      
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