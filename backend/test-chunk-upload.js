// Test chunk upload functionality
async function testChunkUpload() {
  console.log('🧪 Testing chunk upload...')
  
  const moduleId = 'chunk-test-123'
  const testData = Buffer.from('test chunk data')
  
  try {
    const formData = new FormData()
    formData.append('chunk', new Blob([testData]))
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
    formData.append('moduleId', moduleId)

    console.log('📤 Sending chunk upload request...')
    console.log('📦 Chunk data size:', testData.length, 'bytes')
    console.log('📦 Module ID:', moduleId)

    const response = await fetch('http://localhost:8000/api/upload/chunk', {
      method: 'POST',
      body: formData
    })

    console.log('📡 Chunk upload response status:', response.status)
    
    const responseText = await response.text()
    console.log('📡 Chunk upload response body:', responseText)
    
    if (response.ok) {
      console.log('✅ Chunk upload successful')
      
      // Check if the file was actually saved
      const fs = await import('fs')
      const path = await import('path')
      
      const tempDir = path.join(process.cwd(), 'backend', 'uploads', 'temp', moduleId)
      const chunkPath = path.join(tempDir, 'chunk-0')
      
      console.log('📁 Checking temp directory:', tempDir)
      console.log('📁 Checking chunk file:', chunkPath)
      
      if (fs.existsSync(tempDir)) {
        console.log('✅ Temp directory exists')
        
        if (fs.existsSync(chunkPath)) {
          const stats = fs.statSync(chunkPath)
          console.log(`✅ Chunk file exists: ${stats.size} bytes`)
          
          // Read the file content to verify
          const content = fs.readFileSync(chunkPath)
          console.log('📦 File content length:', content.length, 'bytes')
          console.log('📦 File content matches:', content.equals(testData))
        } else {
          console.log('❌ Chunk file not found')
        }
      } else {
        console.log('❌ Temp directory not found')
      }
    } else {
      console.log('❌ Chunk upload failed')
    }
  } catch (error) {
    console.log('❌ Chunk upload error:', error.message)
    console.log('📋 Stack:', error.stack)
  }
}

testChunkUpload() 