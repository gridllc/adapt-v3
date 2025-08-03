import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

const API_BASE = 'http://localhost:8000'

async function testSingleUpload() {
  console.log('🧪 Testing single file upload...')
  
  try {
    // Create a small test file
    const testContent = 'This is a test file for single upload'
    const testBuffer = Buffer.from(testContent)
    
    // Create FormData with the test file
    const formData = new FormData()
    formData.append('file', new Blob([testBuffer], { type: 'video/mp4' }), 'test.mp4')
    
    console.log('📤 Uploading test file...')
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upload failed:', response.status, errorText)
      return
    }
    
    const result = await response.json()
    console.log('✅ Upload successful:', result)
    
    // Check if the file was created
    if (result.moduleId) {
      const filePath = path.join(process.cwd(), 'uploads', `${result.moduleId}.mp4`)
      if (fs.existsSync(filePath)) {
        console.log('✅ File created:', filePath)
      } else {
        console.log('❌ File not found:', filePath)
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testSingleUpload() 