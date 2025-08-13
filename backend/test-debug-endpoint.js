// test-debug-endpoint.js
const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testDebugEndpoint() {
  console.log('🧪 Testing Debug Endpoint...\n');
  
  try {
    // Test 1: Test with a valid module ID (replace with actual ID from your DB)
    console.log('1️⃣ Testing with valid module ID...');
    const moduleId = 'test-module-123'; // Replace with actual module ID
    const response1 = await axios.get(`${BASE_URL}/api/debug/module/${moduleId}`);
    console.log('✅ Response:', response1.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error Response:', error.response.status, error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
  
  console.log('\n🎉 Debug endpoint test completed!');
  console.log('\n💡 To test with a real module ID:');
  console.log('   1. Upload a video first');
  console.log('   2. Get the module ID from the response');
  console.log('   3. Run: curl -s http://localhost:8000/api/debug/module/YOUR_MODULE_ID | jq');
}

testDebugEndpoint();
