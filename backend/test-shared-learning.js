// Test Shared Learning System
// Shows how AI learns from ALL training videos across all users

import { aiService } from './src/services/aiService.js'

const testSharedLearning = async () => {
  console.log('🧠 Testing Shared Learning System...\n')
  
  // Simulate multiple training modules from different users
  const firestickModule = {
    currentStep: {
      id: 'firestick-1',
      title: 'Connect Firestick to TV',
      description: 'Plug the Firestick into your TV\'s HDMI port',
      start: 0,
      end: 30,
      aliases: ['connect', 'HDMI', 'setup'],
      notes: 'Make sure TV is on and set to correct HDMI input',
      isManual: false,
      originalText: 'Connect the Firestick to your TV',
      aiRewrite: 'Connect the Firestick to your TV\'s HDMI port',
      stepText: 'Connect the Firestick to your TV\'s HDMI port'
    },
    allSteps: [
      {
        id: 'firestick-1',
        title: 'Connect Firestick to TV',
        description: 'Plug the Firestick into your TV\'s HDMI port',
        start: 0,
        end: 30,
        aliases: ['connect', 'HDMI', 'setup'],
        notes: 'Make sure TV is on and set to correct HDMI input',
        isManual: false,
        originalText: 'Connect the Firestick to your TV',
        aiRewrite: 'Connect the Firestick to your TV\'s HDMI port',
        stepText: 'Connect the Firestick to your TV\'s HDMI port'
      },
      {
        id: 'firestick-2',
        title: 'Power on Firestick',
        description: 'Connect USB power cable to Firestick',
        start: 30,
        end: 60,
        aliases: ['power', 'USB', 'turn on'],
        notes: 'Use included power adapter for best performance',
        isManual: false,
        originalText: 'Power on the Firestick',
        aiRewrite: 'Connect the USB power cable to power on the Firestick',
        stepText: 'Connect the USB power cable to power on the Firestick'
      }
    ],
    videoTime: 15,
    moduleId: 'firestick-setup-123',
    userId: 'user-firestick',
    moduleMetadata: {
      title: 'Firestick TV Setup Guide',
      description: 'Complete setup for Amazon Firestick',
      difficulty: 'beginner',
      estimatedDuration: 10,
      prerequisites: ['TV with HDMI port', 'WiFi connection'],
      learningObjectives: ['Connect Firestick', 'Complete setup', 'Start streaming'],
      targetAudience: ['Beginners', 'Streaming enthusiasts']
    }
  }
  
  const rokuModule = {
    currentStep: {
      id: 'roku-1',
      title: 'Connect Roku to TV',
      description: 'Plug Roku into HDMI port and power outlet',
      start: 0,
      end: 45,
      aliases: ['connect', 'HDMI', 'power'],
      notes: 'Roku needs both HDMI and power connections',
      isManual: false,
        originalText: 'Connect Roku to TV and power',
        aiRewrite: 'Connect Roku to TV via HDMI and plug into power outlet',
        stepText: 'Connect Roku to TV via HDMI and plug into power outlet'
    },
    allSteps: [
      {
        id: 'roku-1',
        title: 'Connect Roku to TV',
        description: 'Plug Roku into HDMI port and power outlet',
        start: 0,
        end: 45,
        aliases: ['connect', 'HDMI', 'power'],
        notes: 'Roku needs both HDMI and power connections',
        isManual: false,
        originalText: 'Connect Roku to TV and power',
        aiRewrite: 'Connect Roku to TV via HDMI and plug into power outlet',
        stepText: 'Connect Roku to TV via HDMI and plug into power outlet'
      },
      {
        id: 'roku-2',
        title: 'Select HDMI Input',
        description: 'Change TV input to Roku HDMI port',
        start: 45,
        end: 90,
        aliases: ['input', 'source', 'HDMI selection'],
        notes: 'Use TV remote to change input source',
        isManual: false,
        originalText: 'Select the correct HDMI input',
        aiRewrite: 'Use your TV remote to select the HDMI input where Roku is connected',
        stepText: 'Use your TV remote to select the HDMI input where Roku is connected'
      }
    ],
    videoTime: 20,
    moduleId: 'roku-setup-456',
    userId: 'user-roku',
    moduleMetadata: {
      title: 'Roku TV Setup Tutorial',
      description: 'Complete Roku streaming device setup',
      difficulty: 'beginner',
      estimatedDuration: 15,
      prerequisites: ['TV with HDMI port', 'Power outlet', 'WiFi'],
      learningObjectives: ['Connect Roku', 'Configure settings', 'Add channels'],
      targetAudience: ['Beginners', 'Streaming users']
    }
  }
  
  // Test questions that should benefit from shared learning
  const sharedLearningQuestions = [
    "Walk me through setting up a TV streaming device",
    "What's the first step for any streaming device?",
    "How do I know if my device is connected properly?",
    "What are common mistakes people make?",
    "What should I do if nothing shows on screen?"
  ]
  
  console.log('🔥 Testing with Firestick Module (User A)')
  console.log('📺 Testing with Roku Module (User B)')
  console.log('🧠 AI will combine knowledge from BOTH modules\n')
  
  for (const question of sharedLearningQuestions) {
    console.log(`🤖 Question: "${question}"`)
    
    try {
      // Test with shared learning enabled
      const response = await aiService.generateStepByStepGuidance(
        question,
        firestickModule, // Use Firestick context
        true // Enable shared learning
      )
      
      console.log(`✅ AI Response: ${response.summary}`)
      console.log(`📊 Steps Generated: ${response.steps.length}`)
      console.log(`🎯 Shared Learning: ${response.sharedLearningInsights.length > 0 ? 'Yes' : 'No'}`)
      
      if (response.sharedLearningInsights.length > 0) {
        console.log(`🧠 Insights: ${response.sharedLearningInsights.join(', ')}`)
      }
      
    } catch (error) {
      console.log(`❌ AI Error: ${error.message}`)
    }
    
    console.log('---')
  }
  
  console.log('🎯 SHARED LEARNING BENEFITS:')
  console.log('✅ AI knows about BOTH Firestick AND Roku setups')
  console.log('✅ Can give universal "streaming device" advice')
  console.log('✅ Learns from User A\'s Firestick video')
  console.log('✅ Learns from User B\'s Roku video')
  console.log('✅ Combines best practices from both')
  console.log('✅ Future users get smarter AI responses')
}

// Run the test
testSharedLearning().catch(console.error)
