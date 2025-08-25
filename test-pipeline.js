// Quick test script to debug the upload pipeline
// Run this in your browser console on the upload page

async function testPipeline() {
  console.log('🧪 Testing Upload Pipeline...')
  
  // Step 1: Test API connectivity
  console.log('\n1️⃣ Testing API connectivity...')
  try {
    const response = await fetch('/api/health')
    const data = await response.json()
    console.log('✅ API Health:', data)
  } catch (error) {
    console.error('❌ API Health failed:', error)
    return
  }
  
  // Step 2: Test auth
  console.log('\n2️⃣ Testing authentication...')
  try {
    const token = await window.Clerk?.session?.getToken()
    console.log('✅ Auth token:', token ? 'EXISTS' : 'MISSING')
    
    const authTest = await fetch('/api/auth-test', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const authData = await authTest.json()
    console.log('✅ Auth test:', authData)
  } catch (error) {
    console.error('❌ Auth test failed:', error)
  }
  
  // Step 3: Test upload init (without file)
  console.log('\n3️⃣ Testing upload init...')
  try {
    const token = await window.Clerk?.session?.getToken()
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
      console.error('❌ Upload init failed:', initResponse.status, await initResponse.text())
      return
    }
    
    const initData = await initResponse.json()
    console.log('✅ Upload init successful:', {
      success: initData.success,
      moduleId: initData.moduleId,
      hasPresignedUrl: !!initData.presignedUrl
    })
    
    // Step 4: Test upload complete
    console.log('\n4️⃣ Testing upload complete...')
    const completeResponse = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        moduleId: initData.moduleId,
        key: initData.key
      })
    })
    
    if (!completeResponse.ok) {
      console.error('❌ Upload complete failed:', completeResponse.status, await completeResponse.text())
      return
    }
    
    const completeData = await completeResponse.json()
    console.log('✅ Upload complete successful:', completeData)
    
    // Step 5: Monitor processing
    console.log('\n5️⃣ Monitoring processing...')
    let attempts = 0
    const maxAttempts = 10
    
    const checkStatus = async () => {
      attempts++
      console.log(`🔍 Check ${attempts}/${maxAttempts}...`)
      
      try {
        const statusResponse = await fetch(`/api/modules/${initData.moduleId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const statusData = await statusResponse.json()
        
        console.log(`📊 Status: ${statusData.module?.status || statusData.status}, Progress: ${statusData.module?.progress || statusData.progress || 0}%`)
        
        if (statusData.module?.status === 'READY' || attempts >= maxAttempts) {
          console.log('🎉 Testing complete!')
          return
        }
        
        setTimeout(checkStatus, 3000) // Check every 3 seconds
      } catch (error) {
        console.error('❌ Status check failed:', error)
      }
    }
    
    setTimeout(checkStatus, 2000) // Start checking after 2 seconds
    
  } catch (error) {
    console.error('❌ Upload init failed:', error)
  }
}

// Run the test
testPipeline()

console.log(`
🧪 PIPELINE TEST SCRIPT LOADED
Run testPipeline() in your browser console on the upload page
`)
