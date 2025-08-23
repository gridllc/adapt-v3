import { ModuleService } from './moduleService.js'
import { stepSaver } from './ai/stepSaver.js'
import { DatabaseService } from './prismaService.js'

export interface BasicStepData {
  moduleId: string
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED'  // Fixed: Use correct enum values
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
      status: 'READY',  // Fixed: Use correct enum value
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