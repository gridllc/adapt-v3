#!/usr/bin/env node

/**
 * Test script to verify status service is working
 */

import { saveModuleStatus, getModuleStatus } from './src/services/statusService.js'

async function testStatusService() {
  console.log('🧪 Testing Status Service...\n')
  
  const testModuleId = 'test-module-' + Date.now()
  
  try {
    console.log(`📝 Creating status for module: ${testModuleId}`)
    
    // Test 1: Save status
    await saveModuleStatus(testModuleId, 'processing', 'Test processing...', 50)
    console.log('✅ Status saved successfully')
    
    // Test 2: Read status
    const status = await getModuleStatus(testModuleId)
    if (status) {
      console.log('✅ Status read successfully:', status)
    } else {
      console.log('❌ Status read failed')
    }
    
    // Test 3: Update status
    await saveModuleStatus(testModuleId, 'complete', 'Test complete!', 100)
    console.log('✅ Status updated successfully')
    
    // Test 4: Read updated status
    const updatedStatus = await getModuleStatus(testModuleId)
    if (updatedStatus) {
      console.log('✅ Updated status read successfully:', updatedStatus)
    } else {
      console.log('❌ Updated status read failed')
    }
    
    console.log('\n🎉 Status service test completed successfully!')
    
  } catch (error) {
    console.error('❌ Status service test failed:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
  }
}

testStatusService() 