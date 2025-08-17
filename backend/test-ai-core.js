// Direct AI Core Test
// Tests the AI service directly without needing API endpoints

import { aiService } from './src/services/aiService.js'

const testAICore = async () => {
  console.log('🧪 Testing AI Core Service Directly...\n')
  
  // Mock training context (this would come from your actual video)
  const mockTrainingContext = {
    currentStep: {
      id: 'step-1',
      title: 'Enter the house',
      description: 'Safely enter through the front door',
      start: 0,
      end: 30,
      aliases: ['house entry', 'front door'],
      notes: 'Check for obstacles before entering',
      isManual: false,
      originalText: 'Enter the house through the front door',
      aiRewrite: 'Carefully enter the house through the front door',
      stepText: 'Carefully enter the house through the front door'
    },
    allSteps: [
      {
        id: 'step-1',
        title: 'Enter the house',
        description: 'Safely enter through the front door',
        start: 0,
        end: 30,
        aliases: ['house entry', 'front door'],
        notes: 'Check for obstacles before entering',
        isManual: false,
        originalText: 'Enter the house through the front door',
        aiRewrite: 'Carefully enter the house through the front door',
        stepText: 'Carefully enter the house through the front door'
      },
      {
        id: 'step-2',
        title: 'Get the remote',
        description: 'Locate and retrieve the remote control',
        start: 30,
        end: 60,
        aliases: ['remote control', 'TV remote'],
        notes: 'Check common locations like coffee table',
        isManual: false,
        originalText: 'Get the remote control from the table',
        aiRewrite: 'Find and pick up the remote control from the coffee table',
        stepText: 'Find and pick up the remote control from the coffee table'
      }
    ],
    videoTime: 15,
    moduleId: 'test-module-123',
    userId: 'test-user'
  }
  
  // Test questions that work with ANY content
  const testQuestions = [
    "What is the first step?",
    "What should I do next?",
    "Are there any safety tips?",
    "Can you explain this process?",
    "What's the most important thing to remember?"
  ]
  
  for (const question of testQuestions) {
    console.log(`🤖 Question: "${question}"`)
    
    try {
      // Test the AI service directly
      const response = await aiService.generateContextualResponse(
        question,
        mockTrainingContext
      )
      
      console.log(`✅ AI Response: ${response.answer.substring(0, 150)}...`)
      console.log(`📊 Confidence: ${response.confidence || 'N/A'}`)
      console.log(`🎯 Sources: ${response.sources?.length || 0} step references`)
      
    } catch (error) {
      console.log(`❌ AI Error: ${error.message}`)
    }
    
    console.log('---')
  }
}

// Run the test
testAICore().catch(console.error)
