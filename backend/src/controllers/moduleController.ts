import { Request, Response } from 'express'
import { storageService } from '../services/storageService.js'

export const moduleController = {
  async getAllModules(req: Request, res: Response) {
    try {
      const modules = await storageService.getAllModules()
      res.json(modules)
    } catch (error) {
      console.error('Get modules error:', error)
      res.status(500).json({ error: 'Failed to get modules' })
    }
  },

  async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const module = await storageService.getModule(id)
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }
      
      res.json(module)
    } catch (error) {
      console.error('Get module error:', error)
      res.status(500).json({ error: 'Failed to get module' })
    }
  },

  async updateModule(req: Request, res: Response) {
    try {
      const { id } = req.params
      const updateData = req.body
      
      // This would typically update in storage/database
      res.json({ success: true, id })
    } catch (error) {
      console.error('Update module error:', error)
      res.status(500).json({ error: 'Failed to update module' })
    }
  },

  async deleteModule(req: Request, res: Response) {
    try {
      const { id } = req.params
      
      // This would typically delete from storage/database
      res.json({ success: true, id })
    } catch (error) {
      console.error('Delete module error:', error)
      res.status(500).json({ error: 'Failed to delete module' })
    }
  },
} 