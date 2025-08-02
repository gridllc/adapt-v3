// Complete upload test simulating frontend process
async function testCompleteUpload() {
  console.log('🧪 Testing complete upload process...')
  
  const moduleId = 'complete-test-123'
  const fileName = 'test-video.webm'
  
  // Step 1: Create a small test file (simulating compressed video)
  const smallVideoData = Buffer.from('small video data for testing upload process')
  console.log(`📦 Created test file: ${smallVideoData.length} bytes`)
  
  // Step 2: Calculate chunks (simulating frontend logic)
  const chunkSize = 2 * 1024 * 1024 // 2MB
  const totalChunks = Math.max(1, Math.ceil(smallVideoData.length / chunkSize))
  console.log(`📦 Calculated chunks: ${totalChunks} (file size: ${smallVideoData.length}, chunk size: ${chunkSize})`)
  
  // Step 3: Upload chunks
  try {
    const formData = new FormData()
    formData.append('chunk', new Blob([smallVideoData]))
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', totalChunks.toString())
    formData.append('moduleId', moduleId)

    const response = await fetch('http://localhost:8000/api/upload/chunk', {
      method: 'POST',
      body: formData
    })

    console.log('📡 Chunk upload response:', response.status)
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Chunk upload successful:', data)
    } else {
      const error = await response.text()
      console.log('❌ Chunk upload failed:', error)
      return
    }
  } catch (error) {
    console.log('❌ Chunk upload error:', error.message)
    return
  }
  
  // Step 4: Finalize upload
  try {
    const finalizeData = {
      moduleId: moduleId,
      originalFilename: fileName,
      totalChunks: totalChunks
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
      try {
        const data = JSON.parse(responseText)
        console.log('✅ Finalize successful:', data)
      } catch {
        console.log('✅ Finalize successful (non-JSON response)')
      }
    } else {
      try {
        const error = JSON.parse(responseText)
        console.log('❌ Finalize failed:', error)
      } catch {
        console.log('❌ Finalize failed (non-JSON response):', responseText)
      }
    }
  } catch (error) {
    console.log('❌ Finalize error:', error.message)
    console.log('📋 Stack:', error.stack)
  }
  
  // Step 5: Check if file was created
  const finalPath = `C:\\Users\\pgrif\\AI_Projects\\adapt-v3\\uploads\\${moduleId}.mp4`
  console.log(`📁 Checking final file: ${finalPath}`)
  
  try {
    const fs = await import('fs')
    if (fs.existsSync(finalPath)) {
      const stats = fs.statSync(finalPath)
      console.log(`✅ Final file exists: ${stats.size} bytes`)
    } else {
      console.log('❌ Final file not found')
    }
  } catch (error) {
    console.log('❌ Error checking file:', error.message)
  }
  
  console.log('🧪 Complete upload test finished')
}

testCompleteUpload() 