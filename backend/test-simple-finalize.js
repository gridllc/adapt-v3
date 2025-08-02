// Simple test for finalize endpoint
async function testSimpleFinalize() {
  console.log('🧪 Testing simple finalize...')
  
  try {
    const finalizeData = {
      moduleId: 'simple-test-123',
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

    console.log('📡 Response status:', response.status)
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log('📡 Response body:', responseText)
    
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

testSimpleFinalize() 