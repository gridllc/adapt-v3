// TRACE YOUR EXACT FRONTEND UPLOAD PATH
// Copy this into your browser console

async function traceFrontendUpload() {
  console.log('🔍 TRACING YOUR FRONTEND UPLOAD PATH...')
  console.log('===========================================')
  
  try {
    // Create a test file (same as your frontend does)
    console.log('📄 Creating test file...')
    const testFile = new File(['fake video content'], 'test.mp4', { type: 'video/mp4' })
    console.log('✅ File created:', {
      name: testFile.name,
      size: testFile.size,
      type: testFile.type
    })
    
    // Step 1: Check auth (same as your frontend)
    console.log('\n🔐 Checking authentication...')
    if (!window.Clerk?.session) {
      console.error('❌ No Clerk session')
      return
    }
    
    const token = await window.Clerk.session.getToken()
    if (!token) {
      console.error('❌ No auth token')
      return
    }
    console.log('✅ Auth token obtained')
    
    // Step 2: Upload init (same as your uploadWithPresignedUrl function)
    console.log('\n📤 Upload init...')
    const initResponse = await fetch('/api/upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filename: testFile.name,
        contentType: testFile.type || 'video/mp4',
        sizeBytes: testFile.size
      })
    })
    
    console.log('📊 Init Status:', initResponse.status)
    
    if (!initResponse.ok) {
      const errorText = await initResponse.text()
      console.error('❌ Init failed:', errorText)
      return
    }
    
    const initData = await initResponse.json()
    console.log('✅ Init success:', {
      moduleId: initData.moduleId,
      hasPresignedUrl: !!initData.presignedUrl,
      key: initData.key || initData.s3Key
    })
    
    // Step 3: S3 upload (this is where your frontend probably fails)
    console.log('\n☁️ S3 upload (the critical step)...')
    console.log('🔗 S3 URL:', initData.presignedUrl.substring(0, 80) + '...')
    
    try {
      const s3Response = await fetch(initData.presignedUrl, {
        method: 'PUT',
        body: testFile
        // Note: Your frontend code doesn't set Content-Type header for S3!
      })
      
      console.log('📊 S3 Status:', s3Response.status)
      console.log('📊 S3 OK:', s3Response.ok)
      console.log('📊 S3 Headers:', Object.fromEntries(s3Response.headers.entries()))
      
      if (!s3Response.ok) {
        const s3Error = await s3Response.text()
        console.error('❌ S3 UPLOAD FAILED:', s3Error)
        console.log('🔍 This is why your pipeline breaks!')
        
        // Try with Content-Type header
        console.log('\n🔄 Retrying with Content-Type header...')
        const retryResponse = await fetch(initData.presignedUrl, {
          method: 'PUT',
          body: testFile,
          headers: { 'Content-Type': testFile.type }
        })
        
        console.log('📊 Retry Status:', retryResponse.status)
        if (retryResponse.ok) {
          console.log('✅ SUCCESS with Content-Type header!')
          console.log('🔍 Issue: Your frontend needs to set Content-Type for S3')
        }
        return
      }
      
      console.log('✅ S3 upload success!')
      
    } catch (s3Error) {
      console.error('❌ S3 upload exception:', s3Error)
      console.log('🔍 Network or CORS issue with S3')
      return
    }
    
    // Step 4: Upload complete 
    console.log('\n✅ Upload complete...')
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
      console.log('🎉 COMPLETE SUCCESS!')
      console.log('✅ Your pipeline works end-to-end!')
      console.log('🔍 The issue was in the S3 upload step')
    } else {
      const completeError = await completeResponse.text()
      console.error('❌ Complete failed:', completeError)
    }
    
  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

console.log('🧪 FRONTEND UPLOAD TRACER LOADED')
console.log('📋 Run: traceFrontendUpload()')

// Auto-run
setTimeout(traceFrontendUpload, 1000)
