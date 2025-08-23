#!/usr/bin/env node

/**
 * Test script to verify storageService.getSignedPlaybackUrl is working
 */

import { storageService } from './src/services/storageService.js'

async function testStorageService() {
  try {
    console.log('🧪 Testing storageService.getSignedPlaybackUrl...')
    
    // Test with a sample S3 key (this should exist in your bucket)
    const testS3Key = 'users/user_319qypLooViebRSGz3rkd2IvPz5/modules/1755909594113-how to enter my home.mp4'
    
    console.log(`📁 Testing with S3 key: ${testS3Key}`)
    
    const videoUrl = await storageService.getSignedPlaybackUrl(testS3Key, 60 * 10) // 10 min
    
    console.log('✅ Success! Generated signed URL:')
    console.log(`   ${videoUrl.substring(0, 100)}...`)
    console.log(`   Expires in: 10 minutes`)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testStorageService().catch(console.error)
