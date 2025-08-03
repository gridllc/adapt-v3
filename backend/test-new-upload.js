import fs from 'fs'
import path from 'path'

// Test automatic step generation for new uploads
async function testNewUpload() {
  console.log('🧪 Testing automatic step generation for new uploads...')
  
  // Generate a new module ID
  const newModuleId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  console.log(`🆔 Generated test module ID: ${newModuleId}`)
  
  // Copy an existing video file to simulate a new upload
  const sourceVideo = path.join(process.cwd(), 'uploads', 'module_1754194653567_mhq8rit4s.mp4')
  const targetVideo = path.join(process.cwd(), 'uploads', `${newModuleId}.mp4`)
  
  if (!fs.existsSync(sourceVideo)) {
    console.log('❌ Source video not found')
    return
  }
  
  // Copy the video file
  fs.copyFileSync(sourceVideo, targetVideo)
  console.log(`📹 Copied video to: ${targetVideo}`)
  
  // Test the generate endpoint
  try {
    console.log('🤖 Testing step generation...')
    const response = await fetch(`http://localhost:8000/api/steps/generate/${newModuleId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Step generation successful:', result.success)
      console.log(`📊 Generated ${result.steps?.length || 0} steps`)
      
      // Test retrieving the steps
      const stepsResponse = await fetch(`http://localhost:8000/api/steps/${newModuleId}`)
      if (stepsResponse.ok) {
        const stepsResult = await stepsResponse.json()
        console.log('✅ Steps retrieval successful:', stepsResult.success)
        console.log(`📊 Retrieved ${stepsResult.steps?.length || 0} steps`)
      } else {
        console.log('❌ Steps retrieval failed:', stepsResponse.status)
      }
    } else {
      console.log('❌ Step generation failed:', response.status)
      const error = await response.text()
      console.log('Error details:', error)
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message)
  }
  
  // Clean up
  try {
    fs.unlinkSync(targetVideo)
    console.log('🗑️ Cleaned up test video')
  } catch (cleanupError) {
    console.log('⚠️ Failed to clean up test video:', cleanupError.message)
  }
  
  console.log('🧪 Test completed')
}

testNewUpload().catch(console.error) 