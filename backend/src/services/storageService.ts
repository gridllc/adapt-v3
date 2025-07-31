import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple ID generator for now
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export const storageService = {
  async uploadVideo(file: Express.Multer.File): Promise<{ moduleId: string; videoUrl: string }> {
    const moduleId = generateId()
    const uploadsDir = path.resolve(__dirname, '../uploads')
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
    // Use consistent naming: moduleId.mp4 for easier access
    const filename = `${moduleId}.mp4`
    const filePath = path.join(uploadsDir, filename)
    
    // Save file locally with consistent extension
    await fs.promises.writeFile(filePath, file.buffer)
    
    return {
      moduleId,
      videoUrl: `/uploads/${filename}`
    }
  },

  async saveModule(moduleData: any): Promise<string> {
    const moduleId = generateId()
    const dataDir = path.resolve(__dirname, '../data')
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    const modulePath = path.join(dataDir, `${moduleId}.json`)
    await fs.promises.writeFile(modulePath, JSON.stringify(moduleData, null, 2))
    
    return moduleId
  },

  async getModule(moduleId: string): Promise<any> {
    // This would typically fetch from S3 or database
    // For now, return mock data
    return {
      id: moduleId,
      title: 'Sample Training Module',
      description: 'A sample training module',
      videoUrl: 'https://example.com/video.mp4',
      steps: [
        {
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome to the training',
          duration: 30,
        },
      ],
    }
  },

  async getAllModules(): Promise<any[]> {
    // This would typically fetch from S3 or database
    // For now, return mock data
    return [
      {
        id: '1',
        title: 'Coffee Maker Training',
        description: 'Learn how to use your coffee maker',
        videoUrl: 'https://example.com/coffee.mp4',
      },
      {
        id: '2',
        title: 'Fire TV Remote',
        description: 'Master your Fire TV remote controls',
        videoUrl: 'https://example.com/firetv.mp4',
      },
    ]
  },

  async deleteModule(moduleId: string): Promise<boolean> {
    try {
      const dataDir = path.resolve(__dirname, '../data')
      const modulesPath = path.join(dataDir, 'modules.json')
      const uploadsDir = path.resolve(__dirname, '../uploads')
      
      // Read current modules
      let modules = []
      try {
        const raw = await fs.promises.readFile(modulesPath, 'utf-8')
        modules = JSON.parse(raw)
      } catch (err) {
        console.log('No modules.json found or invalid JSON')
        return false
      }
      
      // Find the module to delete
      const moduleIndex = modules.findIndex((m: any) => m.id === moduleId)
      if (moduleIndex === -1) {
        return false
      }
      
      const moduleToDelete = modules[moduleIndex]
      
      // Remove from modules array
      modules.splice(moduleIndex, 1)
      
      // Write updated modules.json
      await fs.promises.writeFile(modulesPath, JSON.stringify(modules, null, 2))
      
      // Delete associated video file
      const videoPath = path.join(uploadsDir, `${moduleId}.mp4`)
      if (fs.existsSync(videoPath)) {
        await fs.promises.unlink(videoPath)
        console.log(`Deleted video file: ${videoPath}`)
      }
      
      // Delete associated data file
      const dataPath = path.join(dataDir, `${moduleId}.json`)
      if (fs.existsSync(dataPath)) {
        await fs.promises.unlink(dataPath)
        console.log(`Deleted data file: ${dataPath}`)
      }
      
      // Delete associated transcript file if exists
      const transcriptPath = path.join(dataDir, 'transcripts', `${moduleId}.json`)
      if (fs.existsSync(transcriptPath)) {
        await fs.promises.unlink(transcriptPath)
        console.log(`Deleted transcript file: ${transcriptPath}`)
      }
      
      console.log(`Successfully deleted module: ${moduleId}`)
      return true
    } catch (error) {
      console.error('Delete module error:', error)
      return false
    }
  },
}

export async function getSignedS3Url(filename: string): Promise<string> {
  // For local development, return the local file URL
  return `/uploads/${filename}`
} 