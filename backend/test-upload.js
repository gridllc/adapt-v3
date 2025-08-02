// Simple test script to verify upload endpoints
import fs from 'fs'
import path from 'path'

async function testUploadEndpoints() {
  console.log('🧪 Testing upload endpoints...')
  
  // Test 1: Check if server is running
  try {
    const response = await fetch('http://localhost:8000/api/health')
    if (response.ok) {
      console.log('✅ Server is running')
    } else {
      console.log('❌ Server health check failed')
      return
    }
  } catch (error) {
    console.log('❌ Cannot connect to server:', error.message)
    return
  }

  // Test 2: Test chunk upload endpoint
  try {
    const testChunk = Buffer.from('test chunk data')
    const formData = new FormData()
    formData.append('chunk', new Blob([testChunk]))
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
    formData.append('moduleId', 'test-module-123')

    const response = await fetch('http://localhost:8000/api/upload/chunk', {
      method: 'POST',
      body: formData
    })

    console.log('📡 Chunk upload test response:', response.status)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Chunk upload test passed:', data)
    } else {
      const error = await response.text()
      console.log('❌ Chunk upload test failed:', error)
    }
  } catch (error) {
    console.log('❌ Chunk upload test error:', error.message)
  }

  // Test 3: Test finalize endpoint
  try {
    const finalizeData = {
      moduleId: 'test-module-123',
      originalFilename: 'test.mp4',
      totalChunks: 1
    }

    const response = await fetch('http://localhost:8000/api/upload/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalizeData)
    })

    console.log('📡 Finalize test response:', response.status)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Finalize test passed:', data)
    } else {
      const error = await response.text()
      console.log('❌ Finalize test failed:', error)
    }
  } catch (error) {
    console.log('❌ Finalize test error:', error.message)
  }

  console.log('🧪 Upload endpoint tests completed')
}

// Run the test if this file is executed directly
testUploadEndpoints() 