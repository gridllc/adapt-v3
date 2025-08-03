import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

const API_BASE = 'http://localhost:8000/api'

async function testAsyncUpload() {
  console.log('🧪 Testing async upload processing...')
  
  try {
    // Create a small test video file (or use existing)
    const testVideoPath = path.join(process.cwd(), 'test-video.mp4')
    
    if (!fs.existsSync(testVideoPath)) {
      console.log('⚠️ No test video found, creating dummy file...')
      // Create a dummy file for testing
      fs.writeFileSync(testVideoPath, 'dummy video content')
    }
    
    // Create form data
    const formData = new FormData()
    formData.append('file', fs.createReadStream(testVideoPath))
    
    console.log('📤 Starting upload...')
    const startTime = Date.now()
    
    // Upload file
    const uploadResponse = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    })
    
    const uploadResult = await uploadResponse.json()
    const uploadTime = Date.now() - startTime
    
    console.log('✅ Upload completed in', uploadTime, 'ms')
    console.log('📊 Upload result:', uploadResult)
    
    if (uploadResult.moduleId) {
      console.log('🔍 Monitoring processing status...')
      
      // Poll for status updates
      let attempts = 0
      const maxAttempts = 20 // 60 seconds total
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
        
        try {
          const statusResponse = await fetch(`${API_BASE}/upload/status/${uploadResult.moduleId}`)
          const status = await statusResponse.json()
          
          console.log(`📊 Status check ${attempts + 1}:`, status)
          
          if (status.status === 'ready') {
            console.log('🎉 Processing completed successfully!')
            break
          } else if (status.status === 'failed') {
            console.log('❌ Processing failed:', status.error)
            break
          }
        } catch (error) {
          console.error('❌ Status check failed:', error)
        }
        
        attempts++
      }
      
      if (attempts >= maxAttempts) {
        console.log('⏰ Monitoring timeout - processing may still be running')
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testAsyncUpload() 