// Debug script for finalize endpoint
import fs from 'fs'
import path from 'path'

async function debugFinalize() {
  console.log('🔍 Debugging finalize endpoint...')
  
  const moduleId = 'debug-test-123'
  const tempDir = path.join(process.cwd(), 'uploads', 'temp', moduleId)
  
  // Step 1: Create temp directory
  console.log(`📁 Creating temp directory: ${tempDir}`)
  await fs.promises.mkdir(tempDir, { recursive: true })
  
  // Step 2: Create a test chunk file
  const testChunk = Buffer.from('test video data for debugging')
  const chunkPath = path.join(tempDir, 'chunk-0')
  await fs.promises.writeFile(chunkPath, testChunk)
  console.log(`📦 Created test chunk: ${chunkPath} (${testChunk.length} bytes)`)
  
  // Step 3: Test chunk upload
  try {
    const formData = new FormData()
    formData.append('chunk', new Blob([testChunk]))
    formData.append('chunkIndex', '0')
    formData.append('totalChunks', '1')
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
  
  // Step 4: Test finalize
  try {
    const finalizeData = {
      moduleId: moduleId,
      originalFilename: 'debug-test.mp4',
      totalChunks: 1
    }

    console.log('📤 Sending finalize request with data:', finalizeData)
    
    const response = await fetch('http://localhost:8000/api/upload/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalizeData)
    })

    console.log('📡 Finalize response status:', response.status)
    console.log('📡 Finalize response headers:', Object.fromEntries(response.headers.entries()))
    
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
    console.log('📋 Error stack:', error.stack)
  }
  
  // Step 5: Check if files were created
  const finalPath = path.join(process.cwd(), 'uploads', `${moduleId}.mp4`)
  console.log(`📁 Checking final file: ${finalPath}`)
  if (fs.existsSync(finalPath)) {
    const stats = fs.statSync(finalPath)
    console.log(`✅ Final file exists: ${stats.size} bytes`)
  } else {
    console.log('❌ Final file not found')
  }
  
  // Step 6: Clean up
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
    console.log('🗑️ Cleaned up temp directory')
  } catch (error) {
    console.log('⚠️ Failed to clean up:', error.message)
  }
  
  console.log('🔍 Debug completed')
}

debugFinalize() 