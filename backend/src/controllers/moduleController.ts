import { Request, Response } from 'express'

export const moduleController = {
  async getAllModules(req: Request, res: Response) {
    try {
      console.log('=== GET ALL MODULES ===')
      
      // Return mock data instead of calling DatabaseService
      const mockModules = [
        {
          id: '1',
          title: 'Coffee Maker Training',
          description: 'Learn how to use your coffee maker',
          videoUrl: 'https://example.com/coffee.mp4',
          createdAt: new Date().toISOString()
        },
        {
          id: '2', 
          title: 'Fire TV Remote',
          description: 'Master your Fire TV remote controls',
          videoUrl: 'https://example.com/firetv.mp4',
          createdAt: new Date().toISOString()
        }
      ]
      
      console.log('✅ Returning modules:', mockModules)
      res.json({ success: true, modules: mockModules })
    } catch (error) {
      console.error('💥 Get modules error:', error)
      res.status(500).json({ error: 'Failed to get modules' })
    }
  },

  async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params
      console.log('=== GET MODULE BY ID ===', id)
      
      // Return mock module data
      const mockModule = {
        id,
        title: 'Sample Training Module',
        description: 'A sample training module',
        videoUrl: 'https://example.com/video.mp4',
        steps: [
          { id: 1, timestamp: 0, title: 'Introduction', description: 'Welcome to the training', duration: 30 },
          { id: 2, timestamp: 30, title: 'Main content', description: 'Core training material', duration: 60 },
          { id: 3, timestamp: 90, title: 'Conclusion', description: 'Wrapping up', duration: 20 }
        ],
        createdAt: new Date().toISOString()
      }
      
      console.log('✅ Returning module:', mockModule)
      res.json({ success: true, module: mockModule })
    } catch (error) {
      console.error('💥 Get module error:', error)
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