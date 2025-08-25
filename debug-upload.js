// REAL-TIME UPLOAD PIPELINE DEBUGGER
// Copy this entire script and paste it into your browser console on the upload page

async function debugUploadPipeline() {
  console.log('🔍 DEBUGGING UPLOAD PIPELINE...')
  console.log('===================================')
  
  // Step 1: Check if we're authenticated
  console.log('\n1️⃣ Testing Authentication...')
  let token
  try {
    token = await window.Clerk?.session?.getToken()
    console.log('✅ Auth token exists:', !!token)
    
    if (!token) {
      console.error('❌ NO AUTH TOKEN - Please sign in first!')
      return
    }
  } catch (error) {
    console.error('❌ Auth failed:', error)
    return
  }
  
  // Step 2: Test API connectivity
  console.log('\n2️⃣ Testing API connectivity...')
  try {
    const healthResponse = await fetch('/api/health')
    const healthData = await healthResponse.json()
    console.log('✅ API Health:', healthData.status)
  } catch (error) {
    console.error('❌ API unreachable:', error)
    return
  }
  
  // Step 3: Test upload init
  console.log('\n3️⃣ Testing Upload Init...')
  let moduleId, s3Key
  try {
    const initResponse = await fetch('/api/upload/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filename: 'debug-test.mp4',
        contentType: 'video/mp4'
      })
    })
    
    console.log('📊 Init Response Status:', initResponse.status)
    
    if (!initResponse.ok) {
      const errorText = await initResponse.text()
      console.error('❌ Upload init failed:', initResponse.status, errorText)
      return
    }
    
    const initData = await initResponse.json()
    moduleId = initData.moduleId
    s3Key = initData.key || initData.s3Key
    
    console.log('✅ Upload Init Success:', {
      moduleId: moduleId,
      hasPresignedUrl: !!initData.presignedUrl,
      s3Key: s3Key
    })
  } catch (error) {
    console.error('❌ Upload init error:', error)
    return
  }
  
  // Step 4: Test upload complete (simulate)
  console.log('\n4️⃣ Testing Upload Complete...')
  try {
    const completeResponse = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        moduleId: moduleId,
        key: s3Key
      })
    })
    
    console.log('📊 Complete Response Status:', completeResponse.status)
    
    if (!completeResponse.ok) {
      const errorText = await completeResponse.text()
      console.error('❌ Upload complete failed:', completeResponse.status, errorText)
      console.log('🔍 This is likely where your pipeline breaks!')
      return
    }
    
    const completeData = await completeResponse.json()
    console.log('✅ Upload Complete Success:', completeData)
    
  } catch (error) {
    console.error('❌ Upload complete error:', error)
    console.log('🔍 This is likely where your pipeline breaks!')
    return
  }
  
  // Step 5: Monitor processing
  console.log('\n5️⃣ Monitoring Processing...')
  let attempts = 0
  const maxAttempts = 20
  
  const monitorProcessing = async () => {
    attempts++
    console.log(`🔍 Check ${attempts}/${maxAttempts}...`)
    
    try {
      const statusResponse = await fetch(`/api/modules/${moduleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!statusResponse.ok) {
        console.error('❌ Status check failed:', statusResponse.status)
        return
      }
      
      const statusData = await statusResponse.json()
      const module = statusData.module || statusData
      
      console.log(`📊 Status: ${module.status || 'UNKNOWN'}, Progress: ${module.progress || 0}%`)
      
      if (module.status === 'READY') {
        console.log('🎉 SUCCESS! Module is ready with steps!')
        console.log('✅ Your pipeline is working correctly!')
        return
      }
      
      if (module.status === 'FAILED') {
        console.error('❌ PROCESSING FAILED!')
        console.log('🔍 Check your backend logs for errors during processing')
        return
      }
      
      if (attempts >= maxAttempts) {
        console.warn('⏰ Monitoring timeout - processing taking too long')
        console.log('🔍 Check your backend logs for stuck processing jobs')
        return
      }
      
      // Continue monitoring
      setTimeout(monitorProcessing, 5000) // Check every 5 seconds
      
    } catch (error) {
      console.error('❌ Status monitoring error:', error)
    }
  }
  
  // Start monitoring after 3 seconds
  setTimeout(monitorProcessing, 3000)
  
  console.log('\n🚀 Test initiated! Monitoring will continue automatically...')
  console.log('📝 Watch the console for updates every 5 seconds')
}

// Auto-run the debug
console.log('🧪 UPLOAD PIPELINE DEBUGGER LOADED')
console.log('📋 To run: debugUploadPipeline()')
console.log('')
console.log('Or run automatically in 2 seconds...')

setTimeout(() => {
  debugUploadPipeline()
}, 2000)
