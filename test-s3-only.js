// ISOLATED S3 UPLOAD TEST
// Copy and paste this into your browser console

async function testS3Only() {
  console.log('🧪 TESTING S3 UPLOAD ONLY...')
  console.log('===============================')
  
  try {
    // Get auth token
    const token = await window.Clerk?.session?.getToken()
    if (!token) {
      console.error('❌ No auth token')
      return
    }
    
    // Get presigned URL
    console.log('🔗 Getting presigned URL...')
    const initResponse = await fetch('/api/upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filename: 'test.mp4',
        contentType: 'video/mp4'
      })
    })
    
    if (!initResponse.ok) {
      console.error('❌ Init failed:', await initResponse.text())
      return
    }
    
    const initData = await initResponse.json()
    console.log('✅ Got presigned URL')
    console.log('🔍 URL preview:', initData.presignedUrl.substring(0, 100) + '...')
    
    // Create tiny test file
    const testContent = 'fake video data'
    const testFile = new Blob([testContent], { type: 'video/mp4' })
    
    // Test S3 upload with detailed logging
    console.log('📤 Uploading to S3...')
    console.log('📄 File size:', testFile.size)
    console.log('📄 Content type:', testFile.type)
    
    const uploadResponse = await fetch(initData.presignedUrl, {
      method: 'PUT',
      body: testFile,
      headers: {
        'Content-Type': 'video/mp4'
      }
    })
    
    console.log('📊 S3 Response Status:', uploadResponse.status)
    console.log('📊 S3 Response Headers:', Object.fromEntries(uploadResponse.headers.entries()))
    
    if (uploadResponse.ok) {
      console.log('✅ S3 UPLOAD SUCCESS!')
      console.log('🎯 The issue is NOT with S3 upload')
      
      // Test if file exists by trying to complete
      console.log('🔍 Testing file verification...')
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
      if (completeResponse.ok) {
        console.log('✅ COMPLETE SUCCESS! Pipeline is working!')
      } else {
        const error = await completeResponse.text()
        console.error('❌ Complete failed:', error)
        console.log('🔍 Issue is in backend verification logic')
      }
      
    } else {
      console.error('❌ S3 UPLOAD FAILED!')
      console.log('🔍 This is your main issue!')
      
      const responseText = await uploadResponse.text()
      console.log('📄 S3 Error Response:', responseText)
      
      // Common S3 issues
      if (uploadResponse.status === 403) {
        console.log('🔍 403 = AWS permissions issue')
        console.log('   - Check AWS_ACCESS_KEY_ID')
        console.log('   - Check AWS_SECRET_ACCESS_KEY') 
        console.log('   - Check S3 bucket permissions')
      } else if (uploadResponse.status === 400) {
        console.log('🔍 400 = Bad request to S3')
        console.log('   - Check presigned URL format')
        console.log('   - Check Content-Type header')
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

console.log('🧪 S3-ONLY TESTER LOADED')
console.log('📋 Run: testS3Only()')

// Auto-run
setTimeout(testS3Only, 1000)
