// backend/src/services/aiResponseGenerator.ts
// AI-powered contextual response generator for training scenarios

import OpenAI from 'openai'
import { 
  TrainingContext, 
  Step, 
  UserProgress, 
  AIAnswer, 
  StepGuidance,
  ContentRecommendation,
  ChatContext,
  Question
} from '../types/training.js'

export class AIResponseGenerator {
  private openai: OpenAI
  private model: string
  private maxTokens: number
  private temperature: number

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.model = process.env.AI_MODEL_OPENAI || 'gpt-4o-mini'
    this.maxTokens = parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '800')
    this.temperature = parseFloat(process.env.AI_TEMPERATURE || '0.2')
  }

  /**
   * Generate contextual AI response based on training context
   */
  async generateContextualResponse(
    question: string, 
    context: TrainingContext
  ): Promise<AIAnswer> {
    try {
      console.log(`🤖 Generating contextual response for: "${question}"`)
      console.log(`📋 Context: Module ${context.moduleId}, Step ${context.currentStep?.id || 'None'}`)

      // Build intelligent prompt based on context
      const prompt = this.buildContextualPrompt(question, context)
      
      // Call OpenAI with proper context
      const response = await this.callOpenAI(prompt, context)
      
      // Parse and format response
      const aiAnswer = this.parseAIResponse(response, context)
      
      console.log(`✅ Contextual response generated successfully`)
      return aiAnswer
      
    } catch (error) {
      console.error('❌ Error generating contextual response:', error)
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate step-specific guidance
   */
  async generateStepGuidance(
    step: Step, 
    userProgress: UserProgress
  ): Promise<StepGuidance> {
    try {
      const prompt = this.buildStepGuidancePrompt(step, userProgress)
      const response = await this.callOpenAI(prompt, { currentStep: step })
      
      return this.parseStepGuidance(response, step)
    } catch (error) {
      console.error('❌ Error generating step guidance:', error)
      throw new Error(`Failed to generate step guidance: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate content recommendations based on user performance
   */
  async adaptContent(
    userProgress: UserProgress,
    moduleContext: TrainingContext
  ): Promise<ContentRecommendation[]> {
    try {
      const prompt = this.buildAdaptationPrompt(userProgress, moduleContext)
      const response = await this.callOpenAI(prompt, moduleContext)
      
      return this.parseContentRecommendations(response)
    } catch (error) {
      console.error('❌ Error generating content recommendations:', error)
      throw new Error(`Failed to generate content recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Chat with context awareness
   */
  async chat(message: string, context: ChatContext): Promise<string> {
    try {
      const prompt = this.buildChatPrompt(message, context)
      const response = await this.callOpenAI(prompt, context)
      
      return this.parseChatResponse(response)
    } catch (error) {
      console.error('❌ Error in AI chat:', error)
      throw new Error(`Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Build contextual prompt for training questions
   */
  private buildContextualPrompt(question: string, context: TrainingContext): string {
    const currentStep = context.currentStep
    const stepContext = currentStep 
      ? `Current Step: "${currentStep.title}" (${currentStep.start}s - ${currentStep.end}s)\nDescription: ${currentStep.description}`
      : 'No specific step context'
    
    const progressContext = context.userProgress 
      ? `User Progress: ${context.userProgress.completedSteps.length}/${context.allSteps.length} steps completed`
      : 'No progress data available'
    
    const stepsContext = context.allSteps.length > 0 
      ? `Available Steps:\n${context.allSteps.map((s, i) => `${i + 1}. ${s.title} (${s.start}s - ${s.end}s)`).join('\n')}`
      : 'No steps available'

    return `You are an expert AI training tutor helping a user learn from a video-based training module.

MODULE CONTEXT:
- Module ID: ${context.moduleId}
- ${stepContext}
- ${progressContext}
- Video Time: ${context.videoTime}s

${stepsContext}

USER QUESTION: "${question}"

INSTRUCTIONS:
1. Provide a clear, helpful answer based on the training content
2. Reference specific steps when relevant
3. Use the user's current progress to tailor your response
4. If the question is about a specific step, focus on that step
5. If the question is general, provide context from relevant steps
6. Keep your response concise but comprehensive
7. Use simple, clear language
8. Include practical examples when helpful

RESPONSE FORMAT:
Provide a direct answer to the user's question, incorporating relevant context from the training material.`
  }

  /**
   * Build prompt for step guidance
   */
  private buildStepGuidancePrompt(step: Step, userProgress: UserProgress): string {
    return `You are an AI training assistant providing guidance for a specific training step.

STEP DETAILS:
- Title: ${step.title}
- Description: ${step.description}
- Duration: ${step.end - step.start} seconds
- Notes: ${step.notes || 'None'}

USER PROGRESS:
- Completed Steps: ${userProgress.completedSteps.length}
- Current Performance: ${userProgress.performanceScore}/100
- Learning Pace: ${userProgress.learningPace}

TASK: Provide helpful guidance for this step including:
1. Clear explanation of what to do
2. Helpful hints
3. Common mistakes to avoid
4. Practical tips
5. Related concepts to understand

Keep guidance concise and actionable.`
  }

  /**
   * Build prompt for content adaptation
   */
  private buildAdaptationPrompt(userProgress: UserProgress, moduleContext: TrainingContext): string {
    return `You are an AI learning path optimizer analyzing user performance to recommend content adaptations.

USER PERFORMANCE:
- Accuracy: ${userProgress.performanceScore}/100
- Learning Pace: ${userProgress.learningPace}
- Difficulty Level: ${userProgress.difficultyLevel}
- Time Spent: ${userProgress.timeSpent} seconds

MODULE CONTEXT:
- Total Steps: ${moduleContext.allSteps.length}
- Completed: ${userProgress.completedSteps.length}

TASK: Recommend content adaptations to optimize learning:
1. Suggest difficulty adjustments
2. Recommend review or practice opportunities
3. Identify areas needing reinforcement
4. Suggest pacing adjustments

Provide specific, actionable recommendations.`
  }

  /**
   * Build prompt for chat interactions
   */
  private buildChatPrompt(message: string, context: ChatContext): string {
    const conversationHistory = context.conversationHistory
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    return `You are an AI training tutor having a conversation with a user.

CONVERSATION CONTEXT:
${conversationHistory}

CURRENT MESSAGE: ${message}

MODULE: ${context.moduleId}
CURRENT STEP: ${context.currentStep?.title || 'None'}

INSTRUCTIONS:
- Provide helpful, contextual responses
- Reference the training material when relevant
- Keep responses conversational but focused
- Help guide the user's learning journey

RESPONSE:`
  }

  /**
   * Call OpenAI API with proper error handling
   */
  private async callOpenAI(prompt: string, context: any): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI training tutor. Provide helpful, accurate, and contextual responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('Empty response from OpenAI')
      }

      return response
    } catch (error) {
      console.error('❌ OpenAI API call failed:', error)
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: string, context: TrainingContext): AIAnswer {
    // Extract related steps from context
    const relatedSteps = context.currentStep 
      ? [context.currentStep.id]
      : context.allSteps.slice(0, 3).map(s => s.id)

    return {
      answer: response.trim(),
      confidence: 0.85, // Default confidence
      sources: [`Module ${context.moduleId}`],
      relatedSteps,
      followUpQuestions: this.generateFollowUpQuestions(response, context),
      difficulty: 'intermediate',
      learningStyle: 'reading'
    }
  }

  /**
   * Parse step guidance response
   */
  private parseStepGuidance(response: string, step: Step): StepGuidance {
    // Simple parsing - in production, you might want more sophisticated parsing
    const lines = response.split('\n').filter(line => line.trim())
    
    return {
      stepId: step.id,
      guidance: response,
      hints: lines.filter(line => line.includes('Hint:') || line.includes('Tip:')).slice(0, 3),
      commonMistakes: lines.filter(line => line.includes('Mistake:') || line.includes('Avoid:')).slice(0, 3),
      tips: lines.filter(line => line.includes('Tip:') || line.includes('Remember:')).slice(0, 3),
      relatedConcepts: [],
      difficultyAdjustment: 'maintain'
    }
  }

  /**
   * Parse content recommendations
   */
  private parseContentRecommendations(response: string): ContentRecommendation[] {
    // Simple parsing - in production, you might want more sophisticated parsing
    return [{
      type: 'practice',
      priority: 'medium',
      reason: 'Based on AI analysis of user performance',
      content: response,
      estimatedTime: 5
    }]
  }

  /**
   * Parse chat response
   */
  private parseChatResponse(response: string): string {
    return response.trim()
  }

  /**
   * Generate follow-up questions based on response
   */
  private generateFollowUpQuestions(response: string, context: TrainingContext): string[] {
    const questions = []
    
    if (context.currentStep) {
      questions.push(`Would you like me to explain more about the current step?`)
    }
    
    if (context.allSteps.length > 0) {
      questions.push(`Do you have questions about any other steps in this module?`)
    }
    
    questions.push(`Is there anything specific you'd like me to clarify?`)
    
    return questions.slice(0, 3)
  }
}

// Export singleton instance
export const aiResponseGenerator = new AIResponseGenerator()
