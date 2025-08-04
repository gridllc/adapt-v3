import { Request, Response } from 'express'
import { DatabaseService } from '../services/prismaService.js'

export const moduleController = {
  async getAllModules(req: Request, res: Response) {
    try {
      const { ownerId, status } = req.query
      const filters = {
        ownerId: ownerId as string | undefined,
        status: status as string | undefined
      }
      const modules = await DatabaseService.getAllModules(filters)
      res.json({ success: true, modules })
    } catch (error) {
      console.error('Get modules error:', error)
      res.status(500).json({ error: 'Failed to get modules' })
    }
  },

  async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const module = await DatabaseService.getModule(id)
      
      if (!module) {
        return res.status(404).json({ error: 'Module not found' })
      }
      
      res.json({ success: true, module })
    } catch (error) {
      console.error('Get module error:', error)
      res.status(500).json({ error: 'Failed to get module' })
    }
  },

  async updateModule(req: Request, res: Response) {
    try {
      const { id } = req.params
      const updateData = req.body

      if (!id) return res.status(400).json({ error: 'Module ID is required' })
      if (!updateData || typeof updateData !== 'object') {
        return res.status(400).json({ error: 'Invalid update data' })
      }

      // Define allowed fields for security
      const allowedFields = ['title', 'status', 'description', 'progress']
      const updateDataFiltered = Object.fromEntries(
        Object.entries(updateData).filter(([key]) => allowedFields.includes(key))
      )

      // Check if any valid fields were provided
      if (Object.keys(updateDataFiltered).length === 0) {
        return res.status(400).json({ 
          error: 'No valid fields provided for update',
          allowedFields 
        })
      }

      const updated = await DatabaseService.updateModule(id, updateDataFiltered)

      if (!updated) {
        return res.status(404).json({ error: 'Module not found or not updated' })
      }

      res.json({ success: true, module: updated })
    } catch (error) {
      console.error('Update module error:', error)
      res.status(500).json({ error: 'Failed to update module' })
    }
  },

  async deleteModule(req: Request, res: Response) {
    try {
      const { id } = req.params
      
      if (!id) {
        return res.status(400).json({ error: 'Module ID is required' })
      }
      
      // Delete from database
      await DatabaseService.deleteModule(id)
      
      res.json({ success: true, id, message: 'Module deleted successfully' })
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma not found error
        return res.status(404).json({ error: 'Module not found' })
      }
      
      console.error('Delete module error:', error)
      res.status(500).json({ error: 'Failed to delete module' })
    }
  },
} 