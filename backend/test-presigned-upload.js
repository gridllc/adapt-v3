#!/usr/bin/env node

/**
 * Test script for the presigned upload flow
 * Run with: node test-presigned-upload.js
 */

const BASE_URL = 'http://localhost:8000'

async function testPresignedUpload() {
  console.log('🧪 Testing Presigned Upload Flow...\n')

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...')
    const healthResponse = await fetch(`${BASE_URL}/api/presigned-upload/health`)
    const healthData = await healthResponse.json()
    
    if (healthResponse.ok) {
      console.log('✅ Health check passed:', healthData)
    } else {
      console.log('❌ Health check failed:', healthData)
      return
    }

    // Test 2: Get presigned URL
    console.log('\n2️⃣ Testing presigned URL endpoint...')
    const presignedResponse = await fetch(`${BASE_URL}/api/presigned-upload/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test-video.mp4',
        contentType: 'video/mp4'
      })
    })
    
    if (!presignedResponse.ok) {
      const errorText = await presignedResponse.text()
      console.log('❌ Presigned URL failed:', presignedResponse.status, errorText)
      return
    }
    
    const presignedData = await presignedResponse.json()
    console.log('✅ Presigned URL generated:', {
      ok: presignedData.ok,
      key: presignedData.key,
      moduleId: presignedData.moduleId,
      hasUploadUrl: !!presignedData.uploadUrl,
      expiresIn: presignedData.expiresIn
    })

    // Verify the response structure
    if (!presignedData.ok || !presignedData.uploadUrl || !presignedData.key || !presignedData.moduleId) {
      console.log('❌ Invalid presigned URL response structure')
      return
    }

    // Verify the key format
    if (!presignedData.key.startsWith('training/')) {
      console.log('❌ Invalid key format - should start with "training/"')
      return
    }

    // Verify the uploadUrl is an S3 URL
    if (!presignedData.uploadUrl.includes('s3.amazonaws.com')) {
      console.log('❌ Invalid upload URL - should be an S3 URL')
      return
    }

    console.log('✅ All presigned URL validations passed')

    // Test 3: Test upload completion endpoint
    console.log('\n3️⃣ Testing upload completion endpoint...')
    const completeResponse = await fetch(`${BASE_URL}/api/presigned-upload/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId: presignedData.moduleId,
        key: presignedData.key,
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: 1024 * 1024 // 1MB
      })
    })
    
    if (!completeResponse.ok) {
      const errorText = await completeResponse.text()
      console.log('❌ Upload completion failed:', completeResponse.status, errorText)
      // This is expected since we haven't actually uploaded to S3
      console.log('ℹ️ This is expected since we haven\'t actually uploaded to S3')
    } else {
      const completeData = await completeResponse.json()
      console.log('✅ Upload completion response:', completeData)
    }

    console.log('\n🎉 Presigned upload flow test completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`   ✅ Health check: ${healthData.status}`)
    console.log(`   ✅ Presigned URL: Generated with key ${presignedData.key}`)
    console.log(`   ✅ Module ID: ${presignedData.moduleId}`)
    console.log(`   ✅ Upload URL: S3 presigned URL generated`)
    console.log(`   ✅ Key format: ${presignedData.key} (starts with training/)`)
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
testPresignedUpload()
