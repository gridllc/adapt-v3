// Test script for small file upload
import fs from 'fs'
import path from 'path'

async function testSmallFileUpload() {
  console.log('🧪 Testing small file upload...')
  
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

  // Test 2: Test with a small file (1 chunk)
  try {
    const smallChunk = Buffer.from('small video data for testing')
    const formData = new FormData()
    formData.append('chunk', new Blob([smallChunk]))
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
    formData.append('moduleId', 'test-small-file-123')

    const response = await fetch('http://localhost:8000/api/upload/chunk', {
      method: 'POST',
      body: formData
    })

    console.log('📡 Small file chunk upload response:', response.status)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Small file chunk upload passed:', data)
    } else {
      const error = await response.text()
      console.log('❌ Small file chunk upload failed:', error)
    }
  } catch (error) {
    console.log('❌ Small file chunk upload error:', error.message)
  }

  // Test 3: Test finalize with small file
  try {
    const finalizeData = {
      moduleId: 'test-small-file-123',
      originalFilename: 'small-test.mp4',
      totalChunks: 1
    }

    const response = await fetch('http://localhost:8000/api/upload/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalizeData)
    })

    console.log('📡 Small file finalize response:', response.status)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Small file finalize passed:', data)
    } else {
      const error = await response.text()
      console.log('❌ Small file finalize failed:', error)
    }
  } catch (error) {
    console.log('❌ Small file finalize error:', error.message)
  }

  console.log('🧪 Small file upload tests completed')
}

testSmallFileUpload() 