import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const stepsController = {
  async getSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params
      console.log(`📖 Getting steps for moduleId: ${moduleId}`)
      
      // Get current directory for debugging
      const currentDir = process.cwd()
      console.log(`🔍 Current directory: ${currentDir}`)
      
      // Define project root
      const projectRoot = path.resolve(__dirname, '..', '..')
      console.log(`📁 Project root: ${projectRoot}`)
      
      // Define possible paths where steps might be stored
      const STEPS_PATHS = [
        path.join(projectRoot, 'data', 'steps'),
        path.join(projectRoot, 'data', 'training'),
        path.join(projectRoot, 'data', 'modules'),
        path.join(projectRoot, 'backend', 'data', 'steps'),
        path.join(projectRoot, 'backend', 'data', 'training'),
        path.join(projectRoot, 'backend', 'data', 'modules')
      ]
      
      console.log(`🔍 STEPS_PATHS:`, STEPS_PATHS)
      console.log(`🔍 Searching for steps file for moduleId: ${moduleId}`)
      
      let stepsData = null
      let foundPath = null
      
      // Search for the steps file
      for (const basePath of STEPS_PATHS) {
        const filePath = path.join(basePath, `${moduleId}.json`)
        console.log(`📁 Checking path: ${filePath}`)
        
        if (fs.existsSync(filePath)) {
          console.log(`✅ Found steps file at: ${filePath}`)
          try {
            const rawData = await fs.promises.readFile(filePath, 'utf-8')
            stepsData = JSON.parse(rawData)
            foundPath = filePath
            break
          } catch (error) {
            console.error(`❌ Error reading file ${filePath}:`, error)
          }
        } else {
          console.log(`❌ File not found at: ${filePath}`)
        }
      }
      
      if (!stepsData) {
        console.error(`❌ Steps not found for moduleId: ${moduleId}`)
        return res.status(404).json({
          error: 'Steps not found',
          moduleId,
          searchedPaths: STEPS_PATHS.map(basePath => path.join(basePath, `${moduleId}.json`))
        })
      }
      
      console.log(`📄 Reading steps from: ${foundPath}`)
      
      // Extract steps from the data structure
      let steps = []
      if (stepsData.steps) {
        steps = stepsData.steps
      } else if (stepsData.enhancedSteps) {
        steps = stepsData.enhancedSteps
      } else if (stepsData.structuredSteps) {
        steps = stepsData.structuredSteps
      } else if (Array.isArray(stepsData)) {
        steps = stepsData
      } else {
        // If it's a module data object, extract steps
        steps = stepsData.originalSteps || stepsData.moduleSteps || []
      }
      
      console.log(`✅ Found ${steps.length} steps for moduleId: ${moduleId}`)
      console.log(`📊 File content keys:`, Object.keys(stepsData))
      
      res.json({
        success: true,
        moduleId,
        steps,
        metadata: {
          totalSteps: steps.length,
          sourceFile: foundPath,
          hasEnhancedSteps: !!stepsData.enhancedSteps,
          hasStructuredSteps: !!stepsData.structuredSteps,
          stats: stepsData.stats || null
        }
      })
      
    } catch (error) {
      console.error('❌ Get steps error:', error)
      res.status(500).json({ 
        error: 'Failed to get steps',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  async createSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params
      const { steps, action, stepIndex } = req.body

      console.log(`📝 Creating/updating steps for module: ${moduleId}`, { action, stepIndex })

      // Find existing steps file
      const projectRoot = path.resolve(__dirname, '..', '..')
      const possiblePaths = [
        path.join(projectRoot, 'data', 'steps', `${moduleId}.json`),
        path.join(projectRoot, 'data', 'training', `${moduleId}.json`),
        path.join(projectRoot, 'backend', 'data', 'steps', `${moduleId}.json`),
        path.join(projectRoot, 'backend', 'data', 'training', `${moduleId}.json`)
      ]

      let existingData = null
      let targetPath = null

      // Try to find existing file
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log(`📄 Found existing file: ${filePath}`)
          const rawData = await fs.promises.readFile(filePath, 'utf-8')
          existingData = JSON.parse(rawData)
          targetPath = filePath
          break
        }
      }

      // If no existing file, create new one
      if (!targetPath) {
        targetPath = path.join(projectRoot, 'data', 'steps', `${moduleId}.json`)
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
        existingData = {
          moduleId,
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }

      // Handle different actions
      if (action === 'add' && Array.isArray(steps)) {
        // Add new steps to existing steps
        existingData.steps = [...(existingData.steps || []), ...steps]
        console.log(`➕ Added ${steps.length} new steps`)
      } else if (action === 'update' && Array.isArray(steps) && typeof stepIndex === 'number') {
        // Update specific step
        if (!existingData.steps) existingData.steps = []
        if (stepIndex >= 0 && stepIndex < existingData.steps.length) {
          existingData.steps[stepIndex] = { ...existingData.steps[stepIndex], ...steps[0] }
          console.log(`✏️ Updated step at index ${stepIndex}`)
        } else {
          return res.status(400).json({ error: 'Invalid step index' })
        }
      } else if (action === 'delete' && typeof stepIndex === 'number') {
        // Delete specific step
        if (!existingData.steps) existingData.steps = []
        if (stepIndex >= 0 && stepIndex < existingData.steps.length) {
          existingData.steps.splice(stepIndex, 1)
          console.log(`🗑️ Deleted step at index ${stepIndex}`)
        } else {
          return res.status(400).json({ error: 'Invalid step index' })
        }
      } else if (action === 'reorder' && Array.isArray(steps)) {
        // Replace all steps with reordered array
        existingData.steps = steps
        console.log(`🔄 Reordered ${steps.length} steps`)
      } else if (Array.isArray(steps)) {
        // Replace all steps (default behavior)
        existingData.steps = steps
        console.log(`🔄 Replaced all steps with ${steps.length} new steps`)
      } else {
        return res.status(400).json({ error: 'Invalid request data' })
      }

      existingData.updatedAt = new Date().toISOString()

      // Write back to file
      await fs.promises.writeFile(targetPath, JSON.stringify(existingData, null, 2))

      console.log(`✅ Steps saved to: ${targetPath}`)

      res.json({
        success: true,
        moduleId,
        stepsCount: existingData.steps.length,
        filePath: targetPath,
        action: action || 'replace'
      })

    } catch (error) {
      console.error('❌ Create/update steps error:', error)
      res.status(500).json({ 
        error: 'Failed to create/update steps',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  async updateSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params
      const { steps } = req.body

      if (!steps || !Array.isArray(steps)) {
        return res.status(400).json({ error: 'Invalid steps data' })
      }

      // Find and update existing steps file
      const projectRoot = path.resolve(__dirname, '..', '..')
      
      const possiblePaths = [
        path.join(projectRoot, 'data', 'steps', `${moduleId}.json`),
        path.join(projectRoot, 'data', 'training', `${moduleId}.json`),
        path.join(projectRoot, 'backend', 'data', 'steps', `${moduleId}.json`),
        path.join(projectRoot, 'backend', 'data', 'training', `${moduleId}.json`)
      ]

      let foundPath = null
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          foundPath = filePath
          break
        }
      }

      if (!foundPath) {
        return res.status(404).json({ error: 'Steps file not found' })
      }

      // Read existing data
      const rawData = await fs.promises.readFile(foundPath, 'utf-8')
      const existingData = JSON.parse(rawData)

      // Update steps
      existingData.steps = steps
      existingData.updatedAt = new Date().toISOString()

      // Write back to file
      await fs.promises.writeFile(foundPath, JSON.stringify(existingData, null, 2))

      console.log(`✅ Steps updated for module ${moduleId}: ${foundPath}`)

      res.json({
        success: true,
        moduleId,
        stepsCount: steps.length,
        filePath: foundPath
      })

    } catch (error) {
      console.error('❌ Update steps error:', error)
      res.status(500).json({ error: 'Failed to update steps' })
    }
  }
} 