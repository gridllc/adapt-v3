// Test finalize with existing chunk
async function testFinalizeWithChunk() {
  console.log('🧪 Testing finalize with existing chunk...')
  
  const moduleId = 'chunk-test-123' // Use the same moduleId from the previous test
  
  try {
    const finalizeData = {
      moduleId: moduleId,
      originalFilename: 'test-video.webm',
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
      
      // Check if the final file was created
      const fs = await import('fs')
      const path = await import('path')
      
      const finalPath = path.join(process.cwd(), 'backend', 'uploads', `${moduleId}.mp4`)
      console.log('📁 Checking final file:', finalPath)
      
      if (fs.existsSync(finalPath)) {
        const stats = fs.statSync(finalPath)
        console.log(`✅ Final file exists: ${stats.size} bytes`)
      } else {
        console.log('❌ Final file not found')
      }
    } else {
      console.log('❌ Finalize failed')
    }
  } catch (error) {
    console.log('❌ Finalize error:', error.message)
    console.log('📋 Stack:', error.stack)
  }
}

testFinalizeWithChunk() 