#!/usr/bin/env node

/**
 * Test script for presigned upload endpoints
 * Run with: node test-presigned-upload.js
 */

const BASE_URL = 'http://localhost:8000'

async function testPresignedUpload() {
  console.log('🧪 Testing Presigned Upload Endpoints...\n')

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...')
    const healthResponse = await fetch(`${BASE_URL}/api/upload/health`)
    const healthData = await healthResponse.json()
    
    if (healthResponse.ok) {
      console.log('✅ Health check passed:', healthData)
    } else {
      console.log('❌ Health check failed:', healthData)
    }

    // Test 2: Get presigned URL (without auth - should fail)
    console.log('\n2️⃣ Testing presigned URL endpoint (no auth)...')
    const presignedResponse = await fetch(`${BASE_URL}/api/upload/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        fileSize: 1024 * 1024 // 1MB
      })
    })
    
    if (presignedResponse.status === 401) {
      console.log('✅ Auth required (expected):', presignedResponse.status)
    } else {
      const presignedData = await presignedResponse.json()
      console.log('⚠️ Unexpected response:', presignedResponse.status, presignedData)
    }

    // Test 3: Process video (without auth - should fail)
    console.log('\n3️⃣ Testing process endpoint (no auth)...')
    const processResponse = await fetch(`${BASE_URL}/api/upload/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: 'https://example.com/test.mp4',
        key: 'test-key'
      })
    })
    
    if (processResponse.status === 401) {
      console.log('✅ Auth required (expected):', processResponse.status)
    } else {
      const processData = await processResponse.json()
      console.log('⚠️ Unexpected response:', processResponse.status, processData)
    }

    // Test 4: Legacy upload (without auth - should fail)
    console.log('\n4️⃣ Testing legacy upload endpoint (no auth)...')
    const formData = new FormData()
    formData.append('file', new Blob(['test content'], { type: 'video/mp4' }), 'test.mp4')
    
    const legacyResponse = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    })
    
    if (legacyResponse.status === 401) {
      console.log('✅ Auth required (expected):', legacyResponse.status)
    } else {
      const legacyData = await legacyResponse.json()
      console.log('⚠️ Unexpected response:', legacyResponse.status, legacyData)
    }

    console.log('\n🎉 All tests completed!')
    console.log('\n📝 Next steps:')
    console.log('1. Start the backend server: npm run dev')
    console.log('2. Test with authentication token')
    console.log('3. Verify S3 presigned URL generation')
    console.log('4. Test direct S3 upload')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n💡 Make sure the backend server is running on port 8000')
  }
}

// Run tests
testPresignedUpload()
