// Minimal finalize test
async function testMinimalFinalize() {
  console.log('🧪 Testing minimal finalize...')
  
  try {
    // First, create a chunk manually
    const fs = await import('fs')
    const path = await import('path')
    
    const moduleId = 'minimal-test-123'
    const tempDir = path.join(process.cwd(), 'backend', 'uploads', 'temp', moduleId)
    const chunkPath = path.join(tempDir, 'chunk-0')
    
    // Create temp directory and chunk file manually
    await fs.promises.mkdir(tempDir, { recursive: true })
    await fs.promises.writeFile(chunkPath, Buffer.from('test data'))
    
    console.log('📁 Created temp directory and chunk file manually')
    console.log('📁 Temp directory:', tempDir)
    console.log('📁 Chunk file:', chunkPath)
    
    // Now test finalize
    const finalizeData = {
      moduleId: moduleId,
      originalFilename: 'test.mp4',
      totalChunks: 1
    }

    console.log('📤 Sending finalize request:', finalizeData)
    
    const response = await fetch('http://localhost:8000/api/upload/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalizeData)
    })

    console.log('📡 Finalize response status:', response.status)
    
    const responseText = await response.text()
    console.log('📡 Finalize response body:', responseText)
    
    if (response.ok) {
      console.log('✅ Finalize successful')
    } else {
      console.log('❌ Finalize failed')
    }
  } catch (error) {
    console.log('❌ Error:', error.message)
    console.log('📋 Stack:', error.stack)
  }
}

testMinimalFinalize() 