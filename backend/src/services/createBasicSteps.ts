import { ModuleService } from './moduleService.js'
import { stepSaver } from './ai/stepSaver.js'

export interface BasicStepData {
  moduleId: string
  status: 'processing' | 'queued' | 'ready' | 'failed'
  progress: number
  message: string
  createdAt: string
  steps: Array<{
    id: string
    timestamp: number
    title: string
    description: string
    duration: number
    originalText?: string  // Original transcript text
    aiRewrite?: string     // AI-rewritten version
    stepText?: string      // Currently displayed text (original or rewritten)
  }>
}

export interface BasicStepsData {
  moduleId: string
  steps: Array<{
    id: string
    timestamp: number
    title: string
    description: string
    duration: number
    originalText?: string  // Original transcript text
    aiRewrite?: string     // AI-rewritten version
    stepText?: string      // Currently displayed text (original or rewritten)
  }>
}

/**
 * Creates basic step files in S3 immediately after upload to prevent "Steps not found" errors
 */
export const createBasicSteps = async (moduleId: string): Promise<{
  trainingData: BasicStepData
  stepsData: BasicStepsData
}> => {
  try {
    console.log(`📝 [createBasicSteps] Creating basic step files for module: ${moduleId}`)
    
    // Get module info
    const module = await ModuleService.get(moduleId)
    if (!module) {
      throw new Error(`Module ${moduleId} not found`)
    }
    
    // Create basic training data
    const trainingData: BasicStepData = {
      moduleId,
      status: 'ready',
      progress: 100,
      message: 'Basic steps created - AI processing will enhance these later',
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: 'step-1',
          timestamp: 0,
          title: 'Introduction',
          description: 'Welcome to this training module',
          duration: 30,
          stepText: 'Introduction and overview of the training content'
        },
        {
          id: 'step-2',
          timestamp: 30,
          title: 'Main Content',
          description: 'Core training material and demonstrations',
          duration: 120,
          stepText: 'Main content and step-by-step instructions'
        },
        {
          id: 'step-3',
          timestamp: 150,
          title: 'Summary',
          description: 'Review and next steps',
          duration: 30,
          stepText: 'Summary of key points and next steps'
        }
      ]
    }
    
    // Create basic steps data (same as training data for now)
    const stepsData: BasicStepsData = {
      moduleId,
      steps: trainingData.steps
    }
    
    // Save to S3 using the standard training path
    const stepsKey = `training/${moduleId}.json`
    await stepSaver.saveStepsToS3({
      moduleId,
      s3Key: stepsKey,
      steps: trainingData.steps,
      transcript: 'Basic transcript - AI processing will enhance this later',
      meta: {
        isBasicSteps: true,
        createdAt: new Date().toISOString(),
        message: 'Basic steps created due to AI processing failure'
      }
    })
    
    // Update the database with the stepsKey
    await ModuleService.updateStepsKey(moduleId, stepsKey)
    
    console.log(`✅ [createBasicSteps] Basic steps created and saved to S3: ${stepsKey}`)
    
    return { trainingData, stepsData }
  } catch (error: any) {
    console.error(`❌ [createBasicSteps] Failed to create basic steps for module ${moduleId}:`, error)
    throw error
  }
}

/**
 * Updates the training data with new status and progress
 * NOTE: This function is commented out due to type incompatibility with ModuleStatus enum
 * The local BasicStepData interface uses different status values than the Prisma enum
 */
/*
export const updateTrainingData = async (moduleId: string, updates: Partial<BasicStepData>): Promise<void> => {
  try {
    console.log(`📝 Updating training data for ${moduleId}:`, updates)
    
    // Update module status in database
    if (updates.status && updates.progress !== undefined) {
      await DatabaseService.updateModuleStatus(
        moduleId, 
        updates.status, 
        updates.progress, 
        updates.message
      )
    }
    
    console.log(`✅ Training data updated for ${moduleId} in database`)
  } catch (error) {
    console.error(`❌ Failed to update training data for ${moduleId}:`, error)
    console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    throw error
  }
}
*/

/**
 * Updates the steps data with new steps
 */
export const updateStepsData = async (moduleId: string, steps: any[]): Promise<void> => {
  try {
    console.log(`📝 Updating steps data for ${moduleId} with ${steps.length} steps`)
    
    // Save steps to database
    await DatabaseService.createSteps(moduleId, steps)
    
    console.log(`✅ Steps data updated for ${moduleId} in database`)
  } catch (error) {
    console.error(`❌ Failed to update steps data for ${moduleId}:`, error)
    console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    throw error
  }
} 