// COMPLETE UPLOAD TEST - Tests the full S3 upload flow
// Copy this entire script and paste it into your browser console on the upload page

async function testRealUpload() {
  console.log('🔍 TESTING REAL UPLOAD FLOW...')
  console.log('====================================')
  
  // Step 1: Check authentication
  console.log('\n1️⃣ Checking Authentication...')
  let token
  try {
    token = await window.Clerk?.session?.getToken()
    if (!token) {
      console.error('❌ NO AUTH TOKEN - Please sign in first!')
      return
    }
    console.log('✅ Authenticated')
  } catch (error) {
    console.error('❌ Auth failed:', error)
    return
  }
  
  // Step 2: Create a tiny test "video" file
  console.log('\n2️⃣ Creating test file...')
  const testContent = 'fake video content for testing'
  const testFile = new File([testContent], 'test-video.mp4', { type: 'video/mp4' })
  console.log('✅ Test file created:', {
    name: testFile.name,
    size: testFile.size,
    type: testFile.type
  })
  
  // Step 3: Get presigned URL
  console.log('\n3️⃣ Getting presigned URL...')
  let initData
  try {
    const initResponse = await fetch('/api/upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filename: testFile.name,
        contentType: testFile.type
      })
    })
    
    if (!initResponse.ok) {
      const errorText = await initResponse.text()
      console.error('❌ Init failed:', initResponse.status, errorText)
      return
    }
    
    initData = await initResponse.json()
    console.log('✅ Presigned URL obtained:', {
      moduleId: initData.moduleId,
      hasUrl: !!initData.presignedUrl,
      key: initData.key || initData.s3Key
    })
  } catch (error) {
    console.error('❌ Init error:', error)
    return
  }
  
  // Step 4: Upload file to S3
  console.log('\n4️⃣ Uploading to S3...')
  try {
    const uploadResponse = await fetch(initData.presignedUrl, {
      method: 'PUT',
      body: testFile,
      headers: {
        'Content-Type': testFile.type
      }
    })
    
    console.log('📊 S3 Upload Status:', uploadResponse.status)
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('❌ S3 upload failed:', uploadResponse.status, errorText)
      console.log('🔍 This is likely why your pipeline fails!')
      
      // Debug the presigned URL
      console.log('🔍 Debug info:')
      console.log('  Presigned URL:', initData.presignedUrl.substring(0, 100) + '...')
      console.log('  File size:', testFile.size)
      console.log('  Content type:', testFile.type)
      return
    }
    
    console.log('✅ File uploaded to S3 successfully!')
  } catch (error) {
    console.error('❌ S3 upload error:', error)
    console.log('🔍 This is likely why your pipeline fails!')
    return
  }
  
  // Step 5: Complete upload
  console.log('\n5️⃣ Completing upload...')
  try {
    const completeResponse = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        moduleId: initData.moduleId,
        key: initData.key || initData.s3Key
      })
    })
    
    console.log('📊 Complete Status:', completeResponse.status)
    
    if (!completeResponse.ok) {
      const errorText = await completeResponse.text()
      console.error('❌ Complete failed:', completeResponse.status, errorText)
      return
    }
    
    const completeData = await completeResponse.json()
    console.log('✅ Upload completed successfully:', completeData)
    
  } catch (error) {
    console.error('❌ Complete error:', error)
    return
  }
  
  // Step 6: Monitor processing
  console.log('\n6️⃣ Monitoring processing...')
  let attempts = 0
  const maxAttempts = 15
  
  const monitor = async () => {
    attempts++
    console.log(`🔍 Check ${attempts}/${maxAttempts}...`)
    
    try {
      const statusResponse = await fetch(`/api/modules/${initData.moduleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!statusResponse.ok) {
        console.error('❌ Status check failed:', statusResponse.status)
        return
      }
      
      const statusData = await statusResponse.json()
      const module = statusData.module || statusData
      
      console.log(`📊 Status: ${module.status}, Progress: ${module.progress || 0}%`)
      
      if (module.status === 'READY') {
        console.log('🎉 SUCCESS! Processing completed!')
        console.log('✅ Your upload pipeline is working!')
        return
      }
      
      if (module.status === 'FAILED') {
        console.error('❌ Processing failed!')
        console.log('🔍 The issue is in the AI processing step')
        return
      }
      
      if (attempts < maxAttempts) {
        setTimeout(monitor, 3000)
      } else {
        console.warn('⏰ Monitoring timeout')
        console.log('🔍 Processing is taking too long - check backend logs')
      }
      
    } catch (error) {
      console.error('❌ Monitoring error:', error)
    }
  }
  
  setTimeout(monitor, 2000)
  console.log('\n🚀 Full test initiated! Watch for updates...')
}

console.log('🧪 REAL UPLOAD TESTER LOADED')
console.log('📋 Run: testRealUpload()')
console.log('')

// Auto-run
setTimeout(testRealUpload, 1000)
