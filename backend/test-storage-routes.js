// test-storage-routes.js
// Simple test script to verify storage routes are working

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testStorageRoutes() {
  console.log('🧪 Testing Storage Routes...\n');

  try {
    // Test 1: Test signed URL generation with valid key
    console.log('1️⃣ Testing signed URL generation with valid key...');
    const response1 = await axios.get(`${BASE_URL}/api/storage/signed-url?key=videos/test-video.mp4`);
    console.log('✅ Response:', response1.data);
    console.log('✅ URL generated:', response1.data.url ? 'YES' : 'NO');
    console.log('');

    // Test 2: Test signed URL generation with missing key
    console.log('2️⃣ Testing signed URL generation with missing key...');
    try {
      const response2 = await axios.get(`${BASE_URL}/api/storage/signed-url`);
      console.log('❌ Should have failed but got:', response2.data);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly failed with 400 status');
        console.log('✅ Error message:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Test 3: Test signed URL generation with empty key
    console.log('3️⃣ Testing signed URL generation with empty key...');
    try {
      const response3 = await axios.get(`${BASE_URL}/api/storage/signed-url?key=`);
      console.log('❌ Should have failed but got:', response3.data);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly failed with 400 status');
        console.log('✅ Error message:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
testStorageRoutes();
