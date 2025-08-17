// backend/src/services/aiService.ts
import { aiResponseGenerator } from './aiResponseGenerator.js'
import { logger } from '../utils/logger.js'

// Core AI functions that the frontend needs
export async function generateContextualResponse(question: string, context: any) {
  try {
    logger.info(`🤖 AI Service: Generating contextual response for "${question}"`)
    return await aiResponseGenerator.generateContextualResponse(question, context)
  } catch (error) {
    logger.error('❌ AI Service: Failed to generate contextual response:', error)
    throw error
  }
}

export async function generateStepGuidance(step: any, userProgress: any) {
  try {
    logger.info(`🎯 AI Service: Generating step guidance for step ${step.id}`)
    return await aiResponseGenerator.generateStepGuidance(step, userProgress)
  } catch (error) {
    logger.error('❌ AI Service: Failed to generate step guidance:', error)
    throw error
  }
}

export async function generateStepByStepGuidance(request: string, context: any, useSharedLearning: boolean = true) {
  try {
    logger.info(`📋 AI Service: Generating step-by-step guidance for "${request}"`)
    return await aiResponseGenerator.generateStepByStepGuidance(request, context, useSharedLearning)
  } catch (error) {
    logger.error('❌ AI Service: Failed to generate step-by-step guidance:', error)
    throw error
  }
}

export async function adaptContent(userProgress: any, moduleContext: any) {
  try {
    logger.info(`🔄 AI Service: Adapting content for user progress`)
    return await aiResponseGenerator.adaptContent(userProgress, moduleContext)
  } catch (error) {
    logger.error('❌ AI Service: Failed to adapt content:', error)
    throw error
  }
}

export async function chat(message: string, context: any) {
  try {
    logger.info(`💬 AI Service: Processing chat message`)
    return await aiResponseGenerator.chat(message, context)
  } catch (error) {
    logger.error('❌ AI Service: Failed to process chat:', error)
    throw error
  }
}

// Export the main aiService object
export const aiService = {
  generateContextualResponse,
  generateStepGuidance,
  generateStepByStepGuidance,
  adaptContent,
  chat
}
