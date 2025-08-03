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
      console.log(`🔍 Looking for steps for module: ${moduleId}`)

      // Define possible paths where steps might be stored
      const isProduction = process.env.NODE_ENV === 'production'
      const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')
      
      const possiblePaths = [
        path.join(baseDir, 'data', 'steps', `${moduleId}.json`),
        path.join(baseDir, 'data', 'training', `${moduleId}.json`),
        path.join(baseDir, 'data', 'modules', `${moduleId}.json`),
        // Also check in uploads directory
        path.join(process.cwd(), 'uploads', 'training', `${moduleId}.json`),
        path.join(process.cwd(), 'backend', 'data', 'training', `${moduleId}.json`)
      ]

      console.log('🔍 Searching in paths:', possiblePaths)

      let stepsData = null
      let foundPath = null

      // Try each path until we find the file
      for (const filePath of possiblePaths) {
        try {
          if (fs.existsSync(filePath)) {
            console.log(`✅ Found steps file at: ${filePath}`)
            const rawData = await fs.promises.readFile(filePath, 'utf-8')
            stepsData = JSON.parse(rawData)
            foundPath = filePath
            break
          } else {
            console.log(`❌ Not found: ${filePath}`)
          }
        } catch (error) {
          console.log(`❌ Error reading ${filePath}:`, error)
        }
      }

      if (!stepsData) {
        console.error(`❌ Steps not found for module ${moduleId}`)
        return res.status(404).json({
          error: 'Steps not found',
          moduleId,
          searchedPaths: possiblePaths,
          message: 'Check server logs for detailed debugging info'
        })
      }

      console.log(`✅ Successfully loaded steps from: ${foundPath}`)
      
      // Return the steps based on the file structure
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

      console.log(`📦 Returning ${steps.length} steps for module ${moduleId}`)

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
      const { steps } = req.body

      if (!steps || !Array.isArray(steps)) {
        return res.status(400).json({ error: 'Invalid steps data' })
      }

      // Save steps to file
      const isProduction = process.env.NODE_ENV === 'production'
      const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')
      const stepsDir = path.join(baseDir, 'data', 'steps')
      
      // Ensure directory exists
      await fs.promises.mkdir(stepsDir, { recursive: true })
      
      const filePath = path.join(stepsDir, `${moduleId}.json`)
      const stepsData = {
        moduleId,
        steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await fs.promises.writeFile(filePath, JSON.stringify(stepsData, null, 2))

      console.log(`✅ Steps created for module ${moduleId}: ${filePath}`)

      res.json({
        success: true,
        moduleId,
        stepsCount: steps.length,
        filePath
      })

    } catch (error) {
      console.error('❌ Create steps error:', error)
      res.status(500).json({ error: 'Failed to create steps' })
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
      const isProduction = process.env.NODE_ENV === 'production'
      const baseDir = isProduction ? '/app' : path.resolve(__dirname, '..')
      
      const possiblePaths = [
        path.join(baseDir, 'data', 'steps', `${moduleId}.json`),
        path.join(baseDir, 'data', 'training', `${moduleId}.json`),
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