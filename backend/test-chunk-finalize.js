import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

const API_BASE = 'http://localhost:8000'

async function testChunkUpload() {
  console.log('🧪 Testing chunk upload and finalize...')
  
  const moduleId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  console.log('🆔 Test module ID:', moduleId)
  
  // Create a small test file
  const testContent = 'This is a test file for chunk upload'
  const testBuffer = Buffer.from(testContent)
  
  try {
    // Upload chunk 0
    console.log('📤 Uploading chunk 0...')
    const formData = new FormData()
    formData.append('chunk', new Blob([testBuffer]), 'chunk-0')
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
    formData.append('moduleId', moduleId)
    
    const chunkResponse = await fetch(`${API_BASE}/api/upload/chunk`, {
      method: 'POST',
      body: formData
    })
    
    if (!chunkResponse.ok) {
      const errorText = await chunkResponse.text()
      console.error('❌ Chunk upload failed:', chunkResponse.status, errorText)
      return
    }
    
    const chunkResult = await chunkResponse.json()
    console.log('✅ Chunk upload successful:', chunkResult)
    
    // Finalize upload
    console.log('🔧 Finalizing upload...')
    const finalizeResponse = await fetch(`${API_BASE}/api/upload/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        moduleId,
        originalFilename: 'test.txt',
        totalChunks: 1
      })
    })
    
    if (!finalizeResponse.ok) {
      const errorText = await finalizeResponse.text()
      console.error('❌ Finalize failed:', finalizeResponse.status, errorText)
      return
    }
    
    const finalizeResult = await finalizeResponse.json()
    console.log('✅ Finalize successful:', finalizeResult)
    
    // Check if the final file exists
    const finalPath = path.join(process.cwd(), 'backend', 'uploads', `${moduleId}.mp4`)
    if (fs.existsSync(finalPath)) {
      console.log('✅ Final file created:', finalPath)
    } else {
      console.log('❌ Final file not found:', finalPath)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testChunkUpload() 