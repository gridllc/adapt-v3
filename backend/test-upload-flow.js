#!/usr/bin/env node

/**
 * Test script for the complete upload flow
 * Run with: node test-upload-flow.js
 */

const BASE_URL = 'http://localhost:8000'

async function testUploadFlow() {
  console.log('🧪 Testing Complete Upload Flow...\n')

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...')
    const healthResponse = await fetch(`${BASE_URL}/api/health`)
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
      key: presignedData.key,
      hasUrl: !!presignedData.presignedUrl
    })

    // Test 3: Confirm upload (simulate successful S3 upload)
    console.log('\n3️⃣ Testing upload confirmation...')
    const confirmResponse = await fetch(`${BASE_URL}/api/presigned-upload/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: presignedData.key
      })
    })
    
    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text()
      console.log('❌ Upload confirmation failed:', confirmResponse.status, errorText)
      return
    }
    
    const confirmData = await confirmResponse.json()
    console.log('✅ Upload confirmed:', {
      moduleId: confirmData.moduleId,
      success: confirmData.success
    })

    // Test 4: Check module status
    if (confirmData.moduleId) {
      console.log('\n4️⃣ Testing module status check...')
      const statusResponse = await fetch(`${BASE_URL}/api/steps/${confirmData.moduleId}`)
      const statusData = await statusResponse.json()
      
      console.log('📊 Module status:', {
        status: statusResponse.status,
        data: statusData
      })
    }

    console.log('\n🎉 Upload flow test completed!')
    console.log('\n📝 Next steps:')
    console.log('1. Check backend logs for AI processing')
    console.log('2. Monitor module status changes')
    console.log('3. Verify steps generation')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n💡 Make sure the backend server is running on port 8000')
  }
}

// Run tests
testUploadFlow()
