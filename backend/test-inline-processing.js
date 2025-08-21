#!/usr/bin/env node

/**
 * Test script to verify inline processing is working
 * Run with: node test-inline-processing.js
 */

import { startProcessing } from './src/services/ai/aiPipeline.js'

async function testInlineProcessing() {
  console.log('🧪 Testing inline processing...')
  
  // Test with a dummy module ID
  const testModuleId = 'test-' + Date.now()
  console.log(`📝 Test module ID: ${testModuleId}`)
  
  try {
    console.log('🚀 Starting inline processing...')
    const result = await startProcessing(testModuleId)
    console.log('✅ Inline processing result:', result)
  } catch (error) {
    console.error('❌ Inline processing failed:', error.message)
    console.log('📋 This is expected if the module doesn\'t exist in the database')
  }
  
  console.log('🏁 Test completed')
}

// Run the test
testInlineProcessing().catch(console.error)
