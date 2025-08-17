import { useState, useCallback } from 'react'
import { logger } from '@utils/logger'

export interface AIQuestion {
  moduleId: string
  question: string
  stepId?: string
  videoTime?: number
}

export interface AIAnswer {
  answer: string
  confidence: number
  sources: string[]
  relatedSteps: string[]
  followUpQuestions: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  learningStyle: 'reading' | 'visual' | 'hands-on'
}

export interface TrainingContext {
  moduleId: string
  currentStep?: {
    id: string
    title: string
    start: number
    end: number
    description: string
    notes?: string
  }
  allSteps: Array<{
    id: string
    title: string
    start: number
    end: number
    description: string
    notes?: string
  }>
  videoTime: number
  userId?: string
  userProgress?: {
    completedSteps: string[]
    currentStepIndex: number
    timeSpent: number
    questionsAsked: number
    performanceScore: number
    lastActiveStep?: string
    learningPace: 'slow' | 'normal' | 'fast'
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
  }
  moduleMetadata?: {
    title: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedDuration: number
    prerequisites: string[]
    learningObjectives: string[]
    targetAudience: string[]
  }
}

export const useModuleAsk = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAnswer, setLastAnswer] = useState<AIAnswer | null>(null)

  const askQuestion = useCallback(async (
    question: AIQuestion,
    context: TrainingContext
  ): Promise<AIAnswer> => {
    setIsLoading(true)
    setError(null)
    
    try {
      logger.info(`🤖 Asking AI question: "${question.question}"`, { moduleId: question.moduleId, stepId: question.stepId })
      
      // Build enhanced training context
      const enhancedContext: TrainingContext = {
        ...context,
        videoTime: question.videoTime || context.videoTime || 0,
        currentStep: question.stepId 
          ? context.allSteps.find(step => step.id === question.stepId)
          : context.currentStep
      }

      // Call the working AI endpoint with better error handling
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: question.moduleId,
          question: question.question,
          stepId: question.stepId,
          context: enhancedContext
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`❌ AI API error: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`AI service error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'AI service failed')
      }

      const aiAnswer: AIAnswer = {
        answer: data.answer || 'No response received',
        confidence: data.confidence || 0.8,
        sources: data.sources || [],
        relatedSteps: data.relatedSteps || [],
        followUpQuestions: data.followUpQuestions || [],
        difficulty: data.difficulty || 'intermediate',
        learningStyle: data.learningStyle || 'reading'
      }
      
      logger.info(`✅ AI response received`, { 
        confidence: aiAnswer.confidence, 
        sources: aiAnswer.sources.length,
        relatedSteps: aiAnswer.relatedSteps.length
      })

      setLastAnswer(aiAnswer)
      return aiAnswer

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response'
      logger.error('❌ AI question failed:', errorMessage)
      setError(errorMessage)
      
      // Return a fallback response instead of throwing
      const fallbackAnswer: AIAnswer = {
        answer: `I apologize, but I'm having trouble processing your request right now. Please try again in a moment. (Error: ${errorMessage})`,
        confidence: 0.1,
        sources: [],
        relatedSteps: [],
        followUpQuestions: ['Try asking again', 'Check your connection', 'Contact support if the problem persists'],
        difficulty: 'intermediate',
        learningStyle: 'reading'
      }
      
      setLastAnswer(fallbackAnswer)
      return fallbackAnswer
    } finally {
      setIsLoading(false)
    }
  }, [])

  const askFollowUpQuestion = useCallback(async (
    followUpQuestion: string,
    context: TrainingContext
  ): Promise<AIAnswer> => {
    if (!lastAnswer) {
      throw new Error('No previous answer to follow up on')
    }

    // Create a new question that references the previous context
    const question: AIQuestion = {
      moduleId: context.moduleId,
      question: followUpQuestion,
      videoTime: context.videoTime
    }

    return askQuestion(question, context)
  }, [lastAnswer, askQuestion])

  const getStepGuidance = useCallback(async (
    stepId: string,
    context: TrainingContext
  ): Promise<AIAnswer> => {
    const step = context.allSteps.find(s => s.id === stepId)
    if (!step) {
      throw new Error(`Step ${stepId} not found`)
    }

    const question: AIQuestion = {
      moduleId: context.moduleId,
      question: `Explain step: ${step.title}`,
      stepId,
      videoTime: context.videoTime
    }

    return askQuestion(question, context)
  }, [askQuestion])

  const getProgressAnalysis = useCallback(async (
    context: TrainingContext
  ): Promise<AIAnswer> => {
    const question: AIQuestion = {
      moduleId: context.moduleId,
      question: 'How am I doing? Analyze my progress and give me tips.',
      videoTime: context.videoTime
    }

    return askQuestion(question, context)
  }, [askQuestion])

  const reset = useCallback(() => {
    setError(null)
    setLastAnswer(null)
    setIsLoading(false)
  }, [])

  return {
    askQuestion,
    askFollowUpQuestion,
    getStepGuidance,
    getProgressAnalysis,
    isLoading,
    error,
    lastAnswer,
    reset
  }
}
