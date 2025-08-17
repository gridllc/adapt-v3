import fs from 'fs/promises'
import path from 'path'
import { DatabaseService } from './prismaService.js'

// Constants for better path management - use the correct path structure
const DATA_DIR = path.join(process.cwd(), 'backend', 'src', 'data')
const TRAINING_DIR = path.join(DATA_DIR, 'training')
const STEPS_DIR = path.join(DATA_DIR, 'steps')

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
 * Creates basic step files immediately after upload to prevent "Steps not found" errors
 */
export const createBasicSteps = async (moduleId: string, filename?: string): Promise<{
  trainingData: BasicStepData
  stepsData: BasicStepsData
}> => {
  try {
    console.log(`📝 Creating basic step files for module: ${moduleId}`)
    console.log(`📁 Using DATA_DIR: ${DATA_DIR}`)
    console.log(`📁 Using TRAINING_DIR: ${TRAINING_DIR}`)
    console.log(`📁 Using STEPS_DIR: ${STEPS_DIR}`)
    
    // Create basic training data
    const trainingData: BasicStepData = {
      moduleId,
      status: 'processing',
      progress: 0,
      message: 'Upload complete, starting AI processing...',
      createdAt: new Date().toISOString(),
      steps: []
    }
    
    // Create basic steps data
    const stepsData: BasicStepsData = {
      moduleId,
      steps: []
    }
    
    // Ensure directories exist
    await fs.mkdir(TRAINING_DIR, { recursive: true })
    await fs.mkdir(STEPS_DIR, { recursive: true })
    
    // Write basic files
    const trainingPath = path.join(TRAINING_DIR, `${moduleId}.json`)
    const stepsPath = path.join(STEPS_DIR, `${moduleId}.json`)
    
    console.log(`📝 Writing training file to: ${trainingPath}`)
    await fs.writeFile(trainingPath, JSON.stringify(trainingData, null, 2))
    
    console.log(`📝 Writing steps file to: ${stepsPath}`)
    await fs.writeFile(stepsPath, JSON.stringify(stepsData, null, 2))
    
    // CRITICAL VALIDATION: Verify files were actually written
    const trainingExists = await fs.access(trainingPath).then(() => true).catch(() => false)
    const stepsExists = await fs.access(stepsPath).then(() => true).catch(() => false)
    
    if (!trainingExists) {
      throw new Error(`Training file was not created: ${trainingPath}`)
    }
    
    if (!stepsExists) {
      throw new Error(`Steps file was not created: ${stepsPath}`)
    }
    
    // Get file sizes to verify content
    const trainingStats = await fs.stat(trainingPath)
    const stepsStats = await fs.stat(stepsPath)
    
    console.log(`📊 Training file size: ${trainingStats.size} bytes`)
    console.log(`📊 Steps file size: ${stepsStats.size} bytes`)
    
    if (trainingStats.size === 0) {
      throw new Error(`Training file is empty: ${trainingPath}`)
    }
    
    if (stepsStats.size === 0) {
      throw new Error(`Steps file is empty: ${stepsPath}`)
    }
    
    console.log(`✅ Basic step files created for module: ${moduleId}`)
    console.log(`📁 Training file: ${trainingPath}`)
    console.log(`📁 Steps file: ${stepsPath}`)
    
    return { trainingData, stepsData }
    
  } catch (error) {
    console.error(`❌ Failed to create basic step files for module ${moduleId}:`, error)
    console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
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
    
    // Save steps to database - use the existing method
    await DatabaseService.createQuestionWithVector({
      moduleId,
      question: 'Steps updated',
      answer: JSON.stringify(steps),
      embedding: []
    })
    
    console.log(`✅ Steps data updated for ${moduleId} in database`)
  } catch (error) {
    console.error(`❌ Failed to update steps data for ${moduleId}:`, error)
    console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    throw error
  }
} 
