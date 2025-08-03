import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get shared module data (public access)
router.get('/:moduleId', async (req, res) => {
  const { moduleId } = req.params
  
  try {
    console.log(`🔗 Public share request for module: ${moduleId}`)
    
    // Define possible paths where module data might be stored
    const projectRoot = path.resolve(__dirname, '../../')
    const possiblePaths = [
      path.join(projectRoot, 'data', 'training', `${moduleId}.json`),
      path.join(projectRoot, 'data', 'steps', `${moduleId}.json`),
      path.join(projectRoot, 'data', 'modules', `${moduleId}.json`)
    ]
    
    let moduleData = null
    let foundPath = null
    
    // Search for the module data
    for (const dataPath of possiblePaths) {
      try {
        await fs.access(dataPath)
        const raw = await fs.readFile(dataPath, 'utf-8')
        moduleData = JSON.parse(raw)
        foundPath = dataPath
        console.log(`✅ Found module data at: ${foundPath}`)
        break
      } catch {
        // Continue to next path
      }
    }
    
    if (!moduleData) {
      console.log(`❌ Module not found: ${moduleId}`)
      return res.status(404).json({ 
        error: 'Module not found',
        message: 'This training module could not be found or is no longer available.'
      })
    }
    
    // Get module metadata from modules.json
    const modulesPath = path.join(process.cwd(), 'data', 'modules.json')
    let moduleMetadata = null
    
    try {
      const modulesRaw = await fs.readFile(modulesPath, 'utf-8')
      const modules = JSON.parse(modulesRaw)
      moduleMetadata = modules.find((m: any) => m.id === moduleId)
    } catch (error) {
      console.log('⚠️ Could not load module metadata')
    }
    
    // Prepare response data
    const responseData = {
      id: moduleId,
      title: moduleMetadata?.title || 'Training Module',
      filename: moduleMetadata?.filename || `${moduleId}.mp4`,
      createdAt: moduleMetadata?.createdAt || moduleData.createdAt,
      steps: moduleData.enhancedSteps || moduleData.structuredSteps || moduleData.originalSteps || [],
      stats: moduleData.stats || null,
      transcript: moduleData.transcript || null
    }
    
    console.log(`✅ Returning shared module data for: ${moduleId}`)
    res.json({
      success: true,
      module: responseData
    })
    
  } catch (error) {
    console.error('❌ Share route error:', error)
    res.status(500).json({ 
      error: 'Failed to load shared module',
      message: 'There was an error loading this training module.'
    })
  }
})

export default router 