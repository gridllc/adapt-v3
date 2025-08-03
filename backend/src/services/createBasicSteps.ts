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
    
    console.log(`📝 Updating training data for ${moduleId}:`, updates)
    console.log(`📝 Writing to: ${trainingPath}`)
    
    await fs.writeFile(trainingPath, JSON.stringify(updatedData, null, 2))
    
    // CRITICAL VALIDATION: Verify file was updated
    const stats = await fs.stat(trainingPath)
    console.log(`📊 Updated training file size: ${stats.size} bytes`)
    
    if (stats.size === 0) {
      throw new Error(`Training file is empty after update: ${trainingPath}`)
    }
    
    console.log(`✅ Training data updated for ${moduleId}`)
  } catch (error) {
    console.error(`❌ Failed to update training data for ${moduleId}:`, error)
    console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    throw error
  }
}

/**
 * Updates the steps data with new steps
 */
export const updateStepsData = async (moduleId: string, steps: any[]): Promise<void> => {
  try {
    const stepsPath = path.join(STEPS_DIR, `${moduleId}.json`)
    
    console.log(`📝 Updating steps data for ${moduleId} with ${steps.length} steps`)
    console.log(`📝 Writing to: ${stepsPath}`)
    
    const stepsData: BasicStepsData = {
      moduleId,
      steps: steps
    }
    
    await fs.writeFile(stepsPath, JSON.stringify(stepsData, null, 2))
    
    // CRITICAL VALIDATION: Verify file was written
    const stats = await fs.stat(stepsPath)
    console.log(`📊 Updated steps file size: ${stats.size} bytes`)
    
    if (stats.size === 0) {
      throw new Error(`Steps file is empty after update: ${stepsPath}`)
    }
    
    // Verify the file contains the expected data
    const writtenData = await fs.readFile(stepsPath, 'utf-8')
    const parsedData = JSON.parse(writtenData)
    
    if (!parsedData.steps || !Array.isArray(parsedData.steps)) {
      throw new Error(`Steps file contains invalid data structure: ${stepsPath}`)
    }
    
    if (parsedData.steps.length !== steps.length) {
      throw new Error(`Steps file contains wrong number of steps: expected ${steps.length}, got ${parsedData.steps.length}`)
    }
    
    console.log(`✅ Steps data updated for ${moduleId}`)
  } catch (error) {
    console.error(`❌ Failed to update steps data for ${moduleId}:`, error)
    console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    throw error
  }
} 