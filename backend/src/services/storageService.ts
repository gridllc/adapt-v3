import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Always resolve from project root, not dist or src
const projectRoot = path.resolve(__dirname, '../../..')
const dataDir = path.join(projectRoot, 'backend', 'src', 'data')
const uploadsDir = path.join(projectRoot, 'backend', 'uploads')

// Simple ID generator for now
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export const storageService = {
  async uploadVideo(file: Express.Multer.File): Promise<{ moduleId: string; videoUrl: string }> {
    const moduleId = generateId()
    
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
      videoUrl: `http://localhost:8000/uploads/${filename}`
    }
  },

  async saveModule(moduleData: any): Promise<string> {
    const moduleId = moduleData.id || generateId()
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    const modulePath = path.join(dataDir, `${moduleId}.json`)
    await fs.promises.writeFile(modulePath, JSON.stringify(moduleData, null, 2))
    
    return moduleId
  },

  async getModule(moduleId: string): Promise<any> {
    try {
      const modulePath = path.join(dataDir, `${moduleId}.json`)
      if (!fs.existsSync(modulePath)) {
        console.log(`Module file not found: ${modulePath}`)
        return null
      }
      const raw = await fs.promises.readFile(modulePath, 'utf-8')
      return JSON.parse(raw)
    } catch (error) {
      console.error('Error loading module:', error)
      return null
    }
  },

  async getAllModules(): Promise<any[]> {
    try {
      const modulesPath = path.join(dataDir, 'modules.json')
      
      // Check if modules.json exists
      if (!fs.existsSync(modulesPath)) {
        console.log('No modules.json found, returning empty array')
        return []
      }
      
      // Read and parse modules.json
      const raw = await fs.promises.readFile(modulesPath, 'utf-8')
      const modules = JSON.parse(raw)
      
      console.log('Loaded modules:', modules)
      return modules
    } catch (error) {
      console.error('Error loading modules:', error)
      return []
    }
  },

  async deleteModule(moduleId: string): Promise<boolean> {
    try {
      const modulesPath = path.join(dataDir, 'modules.json')
      
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
  // For local development, return the local file URL with absolute path
  return `http://localhost:8000/uploads/${filename}`
} 