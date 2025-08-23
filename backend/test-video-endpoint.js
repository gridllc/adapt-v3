#!/usr/bin/env node

/**
 * Test script to verify the video endpoint works
 * Run this to test: node test-video-endpoint.js
 */

const API_BASE = 'https://adapt-v3.onrender.com'

async function testVideoEndpoint() {
  console.log('🧪 Testing video endpoint...')
  
  // Test with a module ID from your logs
  const moduleId = 'cmenhvy8b0001i022f4qogirc'
  
  try {
    const response = await fetch(`${API_BASE}/api/video/${moduleId}/play`)
    const data = await response.json()
    
    console.log('📡 Response status:', response.status)
    console.log('📄 Response data:', JSON.stringify(data, null, 2))
    
    if (data.success && data.url) {
      console.log('✅ Success! Got video URL')
      console.log('🔗 URL:', data.url)
    } else {
      console.log('❌ Failed to get video URL')
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

testVideoEndpoint()
