import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

// Helper function to normalize step format
const normalizeStep = (step: any, index: number) => {
  if (step.startTime !== undefined && step.endTime !== undefined) {
    // Frontend format - already has startTime/endTime
    return {
      id: step.id || `step_${index + 1}`,
      start: step.startTime,
      end: step.endTime,
      title: step.text || '',
      description: step.text || '',
      aliases: step.aliases || [],
      notes: step.notes || '',
      isManual: step.isManual || false
    }
  } else if (step.startTime !== undefined) {
    // New backend format - convert startTime/endTime to start/end for frontend compatibility
    const start = step.startTime
    const end = step.endTime || start + 15 // Use actual endTime, fallback to 15s
    return {
      id: step.id || `step_${index + 1}`,
      start: start,
      end: end,
      title: step.text || '',
      description: step.text || '',
      aliases: step.aliases || [],
      notes: step.notes || '',
      isManual: step.isManual || false
    }
  } else {
    // Fallback for unknown format
    const start = step.startTime || step.start || 0
    const end = step.endTime || step.end || start + 15 // Use actual endTime, fallback to 15s
    return {
      id: step.id || `step_${index + 1}`,
      start: start,
      end: end,
      title: step.text || step.title || '',
      description: step.text || step.description || '',
      aliases: step.aliases || [],
      notes: step.notes || '',
      isManual: step.isManual || false
    }
  }
}

export const stepsController = {
  async rewriteStep(req: Request, res: Response) {
    try {
      const { moduleId } = req.params
      const { text, instruction } = req.body
      
      console.log(`🤖 AI Rewrite requested for module: ${moduleId}`)
      console.log(`📝 Original text: ${text}`)
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' })
      }
      
      // Import AI service
      const { aiService } = await import('../services/aiService.js')
      
      // Use universal prompt if no instruction provided
      const universalPrompt = instruction || "Rewrite this training step to improve clarity, fix grammar, and make it easier to follow. Add helpful details only if something important is missing. Keep it concise, human, and easy to understand."
      
      // Call AI rewrite with universal prompt
      const rewrittenText = await aiService.rewriteStep(text, universalPrompt)
      
      console.log(`✅ AI rewrite successful:`, rewrittenText)
      
      res.json({ text: rewrittenText })
    } catch (error) {
      console.error('❌ AI rewrite error:', error)
      res.status(500).json({ 
        error: 'AI rewrite failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  },

  async getSteps(req: Request, res: Response) {
    try {
      const { moduleId } = req.params
      console.log(`📖 Getting steps for moduleId: ${moduleId}`)

      // TEMPORARY: Return hardcoded response to test routing
      return res.json({
        success: true,
        steps: [{
          id: 'test-step-1',
          moduleId: moduleId,
          order: 1,
          text: 'Test step - routing works',
          startTime: 0,
          endTime: 5
        }],
        source: 'hardcoded-test',
        moduleId
      })

      /* COMMENTED OUT FOR TESTING
      // Get module to find stepsKey and check status
      const { DatabaseService } = await import('../services/prismaService.js')
      const m = await DatabaseService.getModule(moduleId)
      if (!m) {
        return res.status(404).json({ error: 'Module not found' })
      }

      // Check if module is still processing
      if (m.status && m.status !== 'READY') {
        console.log(`⏳ Module ${moduleId} still processing, status: ${m.status}, progress: ${m.progress || 0}`)
        return res.status(202).json({
          processing: true,
          status: m.status,
          progress: m.progress ?? 0,
          moduleId
        })
      }

      // Use stepsKey if it exists, otherwise generate a default key
      const key = (m as any).stepsKey ?? `training/${moduleId}.json`
      console.log(`🔍 Using stepsKey: ${key}`)

      try {
        // Try to get steps from S3 using storageService
        const { storageService } = await import('../services/storageService.js')
        const doc = await storageService.getJson(key)
        console.log(`✅ Retrieved steps from S3: ${key}`)

        return res.json({
          success: true,
          steps: doc?.steps ?? [],
          transcript: doc?.transcript ?? '',
          meta: doc?.meta ?? {},
          source: 's3',
          moduleId
        })
      } catch (s3Error) {
        console.log(`⚠️ S3 retrieval failed, checking database fallback:`, s3Error)

        try {
          // Try to get steps from database as fallback
          const dbSteps = await DatabaseService.getSteps(moduleId)

          if (dbSteps && dbSteps.length > 0) {
            console.log(`✅ Found ${dbSteps.length} steps in database for module: ${moduleId}`)

            // Convert database steps to frontend format
            const normalizedSteps = dbSteps.map((step: any, index: number) => normalizeStep(step, index))

            return res.json({
              success: true,
              moduleId,
              steps: normalizedSteps,
              source: 'database',
              metadata: {
                totalSteps: normalizedSteps.length,
                sourceFile: 'database',
                hasEnhancedSteps: false,
                hasStructuredSteps: false,
                hasOriginalSteps: true
              }
            })
          }
        } catch (dbError) {
          console.log(`⚠️ Database fallback failed:`, dbError)
        }

        // If we get here, the module is READY but no steps found - this is an error
        console.log(`❌ Module ${moduleId} is READY but no steps found`)
        return res.status(404).json({
          error: 'Steps not found',
          message: 'Module processing is complete but no steps were generated',
          moduleId
        })
      }
      */
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

      // Check if this is an AI generation request (no steps provided)
      if (!steps && !action) {
        console.log(`🤖 AI step generation requested for module: ${moduleId}`)
        
        try {
          // Import AI service
          const { aiService } = await import('../services/aiService.js')
          
          // Get module data to find video URL
          const { DatabaseService } = await import('../services/prismaService.js')
          const moduleData = await DatabaseService.getModule(moduleId)
          
          if (!moduleData) {
            return res.status(404).json({ 
              error: 'Module not found',
              moduleId 
            })
          }

          if (!moduleData.videoUrl) {
            return res.status(400).json({ 
              error: 'Module has no video URL for AI processing',
              moduleId 
            })
          }

          console.log(`🎬 Starting AI processing for video: ${moduleData.videoUrl}`)
          
          // Generate steps using AI
          await aiService.generateStepsForModule(moduleId, moduleData.videoUrl)
          
          console.log(`✅ AI processing started for module: ${moduleId}`)
          
          // Return processing status since the function now handles everything internally
          res.json({
            success: true,
            moduleId,
            steps: [],
            message: 'AI processing started successfully',
            source: 'ai',
            status: 'processing',
            metadata: {
              totalSteps: 0,
              title: 'Processing',
              description: 'AI is generating steps',
              totalDuration: 0
            }
          })
          
          return
          
        } catch (aiError) {
          console.error(`❌ AI step generation failed for module ${moduleId}:`, aiError)
          return res.status(500).json({ 
            error: 'AI step generation failed',
            message: aiError instanceof Error ? aiError.message : 'Unknown error',
            moduleId
          })
        }
      }

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

      // Convert frontend step format to backend format
      const convertToBackendFormat = (step: any) => {
        // Handle different input formats - now we save in startTime/endTime format
        let startTime = 0
        let endTime = 30
        
        if (step.startTime !== undefined && step.endTime !== undefined) {
          // Already in startTime/endTime format
          startTime = step.startTime
          endTime = step.endTime
        } else if (step.start !== undefined && step.end !== undefined) {
          // Frontend format: convert start/end to startTime/endTime
          startTime = step.start
          endTime = step.end
        } else if (step.timestamp !== undefined) {
          // Old backend format: convert timestamp/duration to startTime/endTime
          startTime = step.timestamp
          endTime = startTime + (step.duration || 15) // Use actual duration, fallback to 15s
        } else {
          // Fallback
          startTime = step.timestamp || step.start || step.startTime || 0
          endTime = step.endTime || step.end || startTime + 15 // Use actual endTime, fallback to 15s
        }
        
        return {
          id: step.id,
          text: step.text || step.title || step.description || '',
          startTime: startTime,
          endTime: endTime,
          order: step.order || 0,
          aliases: step.aliases || [],
          notes: step.notes || '',
          isManual: step.isManual || false
        }
      }

      // Handle different actions
      if (action === 'add' && Array.isArray(steps)) {
        // Add new steps to existing steps
        const backendSteps = steps.map(convertToBackendFormat)
        existingData.steps = [...(existingData.steps || []), ...backendSteps]
        console.log(`➕ Added ${steps.length} new steps`)
      } else if (action === 'update' && Array.isArray(steps) && typeof stepIndex === 'number') {
        // Update specific step
        if (!existingData.steps) existingData.steps = []
        if (stepIndex >= 0 && stepIndex < existingData.steps.length) {
          existingData.steps[stepIndex] = convertToBackendFormat(steps[0])
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
        existingData.steps = steps.map(convertToBackendFormat)
        console.log(`🔄 Reordered ${steps.length} steps`)
      } else if (Array.isArray(steps)) {
        // Replace all steps (default behavior)
        existingData.steps = steps.map(convertToBackendFormat)
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

      // Convert frontend format to backend format
      const convertToBackendFormat = (step: any) => {
        // Handle different input formats - now we save in startTime/endTime format
        let startTime = 0
        let endTime = 30
        
        if (step.startTime !== undefined && step.endTime !== undefined) {
          // Already in startTime/endTime format
          startTime = step.startTime
          endTime = step.endTime
        } else if (step.start !== undefined && step.end !== undefined) {
          // Frontend format: convert start/end to startTime/endTime
          startTime = step.start
          endTime = step.end
        } else if (step.timestamp !== undefined) {
          // Old backend format: convert timestamp/duration to startTime/endTime
          startTime = step.timestamp
          endTime = startTime + (step.duration || 15) // Use actual duration, fallback to 15s
        } else {
          // Fallback
          startTime = step.timestamp || step.start || step.startTime || 0
          endTime = step.endTime || step.end || startTime + 15 // Use actual endTime, fallback to 15s
        }
        
        return {
          id: step.id,
          text: step.text || step.title || step.description || '',
          startTime: startTime,
          endTime: endTime,
          order: step.order || 0,
          aliases: step.aliases || [],
          notes: step.notes || '',
          isManual: step.isManual || false
        }
      }

      // Update steps
      existingData.steps = steps.map(convertToBackendFormat)
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