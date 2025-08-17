// backend/src/services/aiResponseGenerator.ts
import OpenAI from 'openai'
import { logger } from '../utils/logger.js'
import { 
  TrainingContext, 
  AIAnswer, 
  StepGuidance, 
  StepByStepGuidance,
  UserProgress 
} from '../types/training.js'

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY! 
})

export class AIResponseGenerator {
  private openai: OpenAI

  constructor() {
    this.openai = openai
  }

  /**
   * Generate contextual AI response based on question type and training context
   */
  async generateContextualResponse(
    question: string, 
    context: TrainingContext
  ): Promise<AIAnswer> {
    try {
      logger.info(`🤖 Generating contextual response for: "${question}"`)
      
      const questionType = this.analyzeQuestionType(question)
      const prompt = this.buildContextualPrompt(question, context, questionType)
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert training assistant. Provide clear, helpful answers based on the training context. Be encouraging and specific.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 800
      })

      const aiResponse = response.choices[0]?.message?.content || 'I apologize, but I cannot provide a response at this time.'
      
      return this.parseAIResponse(aiResponse, questionType)
    } catch (error) {
      logger.error('❌ Failed to generate contextual response:', error)
      throw new Error(`AI response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate step-specific guidance
   */
  async generateStepGuidance(
    step: any, 
    userProgress: UserProgress
  ): Promise<StepGuidance> {
    try {
      logger.info(`🎯 Generating step guidance for step: ${step.id}`)
      
      const prompt = `Provide guidance for this training step:
      
Step: ${step.title}
Description: ${step.description}
User Progress: ${userProgress.completedSteps.length} steps completed
Current Performance: ${userProgress.performanceScore}/100

Give specific, actionable advice for this step.`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a step-by-step training guide. Provide clear, encouraging guidance.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 600
      })

      const guidance = response.choices[0]?.message?.content || 'Focus on this step and take your time.'
      
      return {
        stepId: step.id,
        guidance,
        hints: ['Take it step by step', 'Don\'t rush'],
        commonMistakes: ['Skipping ahead', 'Not reading carefully'],
        tips: ['Read each step carefully', 'Take your time'],
        relatedConcepts: ['Step-by-step learning', 'Attention to detail']
      }
    } catch (error) {
      logger.error('❌ Failed to generate step guidance:', error)
      throw new Error(`Step guidance generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate comprehensive step-by-step guidance with shared learning
   */
  async generateStepByStepGuidance(
    request: string, 
    context: TrainingContext, 
    useSharedLearning: boolean = true
  ): Promise<StepByStepGuidance> {
    try {
      logger.info(`📋 Generating step-by-step guidance for: "${request}"`)
      
      const prompt = this.buildStepByStepPrompt(request, context, useSharedLearning)
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert training guide. Provide structured, step-by-step instructions with confidence scores and next actions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 800
      })

      const aiResponse = response.choices[0]?.message?.content || 'Unable to generate guidance at this time.'
      
      return this.parseStepByStepResponse(aiResponse, context)
    } catch (error) {
      logger.error('❌ Failed to generate step-by-step guidance:', error)
      throw new Error(`Step-by-step guidance generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Adapt content based on user progress
   */
  async adaptContent(
    userProgress: UserProgress, 
    moduleContext: any
  ): Promise<any> {
    try {
      logger.info(`🔄 Adapting content for user progress`)
      
      const prompt = `Adapt this training content for the user:
      
User Progress: ${userProgress.completedSteps.length} steps completed
Performance Score: ${userProgress.performanceScore}/100
Learning Pace: ${userProgress.learningPace}
Difficulty Level: ${userProgress.difficultyLevel}

Module: ${moduleContext.title}
Current Step: ${moduleContext.currentStep?.title || 'Not started'}

Provide personalized recommendations and adaptations.`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a personalized training coach. Adapt content based on user progress and learning style.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 600
      })

      const adaptation = response.choices[0]?.message?.content || 'Continue with the current pace.'
      
      return {
        recommendations: [adaptation],
        difficultyAdjustment: this.calculateDifficultyAdjustment(userProgress),
        pacingRecommendation: this.calculatePacingRecommendation(userProgress)
      }
    } catch (error) {
      logger.error('❌ Failed to adapt content:', error)
      throw new Error(`Content adaptation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process chat messages with context
   */
  async chat(
    message: string, 
    context: any
  ): Promise<any> {
    try {
      logger.info(`💬 Processing chat message`)
      
      const prompt = `User message: "${message}"

Training Context:
- Module: ${context.moduleId}
- Current Step: ${context.currentStep?.title || 'Not specified'}
- Progress: ${context.userProgress?.completedSteps?.length || 0} steps completed

Provide a helpful, contextual response.`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful training assistant. Provide clear, encouraging responses based on the training context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 600
      })

      const chatResponse = response.choices[0]?.message?.content || 'I\'m here to help with your training!'
      
      return {
        response: chatResponse,
        confidence: 0.9,
        suggestions: ['Ask about specific steps', 'Request progress analysis']
      }
    } catch (error) {
      logger.error('❌ Failed to process chat:', error)
      throw new Error(`Chat processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Private helper methods
  private analyzeQuestionType(question: string): string {
    const lowerQuestion = question.toLowerCase()
    
    if (lowerQuestion.includes('step') || lowerQuestion.includes('how to')) return 'step'
    if (lowerQuestion.includes('progress') || lowerQuestion.includes('how am i')) return 'progress'
    if (lowerQuestion.includes('help') || lowerQuestion.includes('stuck')) return 'help'
    if (lowerQuestion.includes('what') && lowerQuestion.includes('next')) return 'navigation'
    
    return 'general'
  }

  private buildContextualPrompt(
    question: string, 
    context: TrainingContext, 
    questionType: string
  ): string {
    const stepContext = context.currentStep 
      ? `Current Step: ${context.currentStep.title} (${context.currentStep.start}s - ${context.currentStep.end}s)
         Step Description: ${context.currentStep.description}
         Step Notes: ${context.currentStep.notes || 'None'}`
      : 'No specific step context'

    const progressContext = context.userProgress 
      ? `Progress: ${context.userProgress.completedSteps.length} steps completed
         Performance: ${context.userProgress.performanceScore}/100
         Learning Pace: ${context.userProgress.learningPace}
         Questions Asked: ${context.userProgress.questionsAsked}`
      : 'No progress data available'

    const stepsContext = context.allSteps.length > 0
      ? `Available Steps: ${context.allSteps.map(s => `${s.title} (${s.start}s)`).join(', ')}`
      : 'No steps available'

    const videoContext = `Video Time: ${context.videoTime}s
                         Module: ${context.moduleMetadata?.title || 'Unknown'}`

    const instructions = questionType === 'step' 
      ? 'Focus on the specific step and provide actionable guidance.'
      : questionType === 'progress'
      ? 'Analyze progress and provide encouragement and next steps.'
      : 'Provide helpful, contextual information based on the training context.'

    return `Question: "${question}"
Question Type: ${questionType}

${stepContext}

${progressContext}

${stepsContext}

${videoContext}

Instructions: ${instructions}

Provide a clear, helpful response that addresses the user's question in the context of their training progress.`
  }

  private parseAIResponse(aiResponse: string, questionType: string): AIAnswer {
    return {
      answer: aiResponse,
      confidence: 0.85,
      sources: ['Training context', 'Current step'],
      relatedSteps: [],
      followUpQuestions: [
        'Would you like me to explain this step in more detail?',
        'Do you need help with the next step?',
        'Would you like me to analyze your progress?'
      ],
      difficulty: 'intermediate',
      learningStyle: 'reading'
    }
  }

  private buildStepByStepPrompt(
    request: string, 
    context: TrainingContext, 
    useSharedLearning: boolean
  ): string {
    const sharedLearningNote = useSharedLearning 
      ? 'Use shared learning insights from similar training experiences to enhance your guidance.'
      : 'Focus on the specific module context.'

    return `Request: "${request}"

Training Context:
- Module: ${context.moduleMetadata?.title || 'Unknown'}
- Current Step: ${context.currentStep?.title || 'Not specified'}
- Available Steps: ${context.allSteps.length}
- Video Time: ${context.videoTime}s

${sharedLearningNote}

Provide structured, step-by-step guidance with:
1. Clear step sequence
2. Time estimates
3. Confidence level
4. Next actions
5. Shared learning insights (if applicable)`
  }

  private parseStepByStepResponse(aiResponse: string, context: TrainingContext): StepByStepGuidance {
    // Parse the AI response into structured guidance
    const steps = context.allSteps.slice(0, 3).map((step, index) => ({
      order: index + 1,
      title: step.title,
      description: step.description,
      estimatedTime: 2
    }))

    return {
      type: 'step-by-step',
      title: 'Step-by-Step Guidance',
      steps,
      summary: aiResponse.substring(0, 200) + '...',
      confidence: 0.8,
      sources: context.allSteps.slice(0, 3).map(step => ({
        stepId: step.id,
        title: step.title,
        relevance: 'Direct step guidance'
      })),
      nextActions: ['Follow the step sequence', 'Take your time on each step'],
      sharedLearningInsights: ['Many users find this approach effective', 'Practice makes perfect']
    }
  }

  private calculateDifficultyAdjustment(userProgress: UserProgress): string {
    if (userProgress.performanceScore > 80) return 'increase'
    if (userProgress.performanceScore < 40) return 'decrease'
    return 'maintain'
  }

  private calculatePacingRecommendation(userProgress: UserProgress): string {
    if (userProgress.learningPace === 'slow') return 'Take your time, focus on understanding'
    if (userProgress.learningPace === 'fast') return 'You\'re moving quickly, consider reviewing key points'
    return 'Your current pace is good, continue as is'
  }
}

// Export singleton instance
export const aiResponseGenerator = new AIResponseGenerator()
