// Test script to verify upload endpoint functionality
const fs = require('fs')
const path = require('path')

async function testUploadEndpoint() {
  try {
    console.log('🧪 Testing upload endpoint...')
    
    // Create a test file
    const testFile = path.join(__dirname, 'test-video.mp4')
    fs.writeFileSync(testFile, 'test video content')
    
    console.log('📁 Test file created:', testFile)
    
    // Test the health endpoint first
    const healthResponse = await fetch('http://localhost:8000/api/health')
    const healthData = await healthResponse.json()
    console.log('✅ Health check:', healthData.status)
    
    // Test the upload endpoint
    const formData = new FormData()
    formData.append('file', fs.createReadStream(testFile))
    
    console.log('📤 Testing upload endpoint...')
    const uploadResponse = await fetch('http://localhost:8000/api/upload', {
      method: 'POST',
      body: formData
    })
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json()
      console.log('✅ Upload successful:', uploadResult)
      
      if (uploadResult.moduleId) {
        console.log('🔍 Testing status endpoint...')
        const statusResponse = await fetch(`http://localhost:8000/api/upload/status/${uploadResult.moduleId}`)
        const statusData = await statusResponse.json()
        console.log('✅ Status check:', statusData)
      }
    } else {
      console.error('❌ Upload failed:', uploadResponse.status, uploadResponse.statusText)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  } finally {
    // Clean up
    const testFile = path.join(__dirname, 'test-video.mp4')
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile)
      console.log('🧹 Test file cleaned up')
    }
  }
}

// Run the test
testUploadEndpoint() 