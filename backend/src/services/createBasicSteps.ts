import fs from 'fs/promises'
import path from 'path'

// Constants for better path management - use process.cwd() for consistency
const DATA_DIR = path.join(process.cwd(), 'data')
const TRAINING_DIR = path.join(DATA_DIR, 'training')
const STEPS_DIR = path.join(DATA_DIR, 'steps')

export interface BasicStepData {
  moduleId: string
  status: 'processing' | 'queued' | 'ready' | 'failed'
  progress: number
  message: string
  createdAt: string
  steps: any[]
}

export interface BasicStepsData {
  moduleId: string
  steps: any[]
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
    
    await fs.writeFile(trainingPath, JSON.stringify(trainingData, null, 2))
    await fs.writeFile(stepsPath, JSON.stringify(stepsData, null, 2))
    
    console.log(`✅ Basic step files created for module: ${moduleId}`)
    console.log(`📁 Training file: ${trainingPath}`)
    console.log(`📁 Steps file: ${stepsPath}`)
    
    return { trainingData, stepsData }
    
  } catch (error) {
    console.error(`❌ Failed to create basic step files for module ${moduleId}:`, error)
    throw error
  }
}

/**
 * Updates the training data with new status and progress
 */
export const updateTrainingData = async (moduleId: string, updates: Partial<BasicStepData>): Promise<void> => {
  try {
    const trainingPath = path.join(TRAINING_DIR, `${moduleId}.json`)
    
    // Read existing data
    let trainingData: BasicStepData
    try {
      const raw = await fs.readFile(trainingPath, 'utf-8')
      trainingData = JSON.parse(raw)
    } catch {
      // If file doesn't exist, create basic structure
      trainingData = {
        moduleId,
        status: 'processing',
        progress: 0,
        message: 'Processing...',
        createdAt: new Date().toISOString(),
        steps: []
      }
    }
    
    // Update with new data
    const updatedData = { ...trainingData, ...updates }
    
    // Write back to file
    await fs.writeFile(trainingPath, JSON.stringify(updatedData, null, 2))
    
    console.log(`✅ Updated training data for module ${moduleId}:`, updates)
    
  } catch (error) {
    console.error(`❌ Failed to update training data for module ${moduleId}:`, error)
    throw error
  }
}

/**
 * Updates the steps data with new steps
 */
export const updateStepsData = async (moduleId: string, steps: any[]): Promise<void> => {
  try {
    const stepsPath = path.join(STEPS_DIR, `${moduleId}.json`)
    
    const stepsData: BasicStepsData = {
      moduleId,
      steps
    }
    
    await fs.writeFile(stepsPath, JSON.stringify(stepsData, null, 2))
    
    console.log(`✅ Updated steps data for module ${moduleId}: ${steps.length} steps`)
    
  } catch (error) {
    console.error(`❌ Failed to update steps data for module ${moduleId}:`, error)
    throw error
  }
} 