#!/usr/bin/env node

/**
 * Test script to verify API configuration
 */

console.log('🧪 Testing API Configuration...\n')

// Simulate the environment variables
process.env.MODE = 'development'
process.env.VITE_API_BASE_URL = ''

// Test the API base URL logic
const isDevelopment = process.env.MODE === 'development'
const RENDER_URL = 'https://adapt-v3-backend.onrender.com'
const API_BASE_URL = process.env.VITE_API_BASE_URL || 
  (isDevelopment ? '' : RENDER_URL)

console.log('🔧 API Configuration:')
console.log('  Mode:', process.env.MODE)
console.log('  Is Development:', isDevelopment)
console.log('  VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL)
console.log('  API_BASE_URL:', API_BASE_URL)
console.log('  Render URL:', RENDER_URL)

// Test URL construction
const testEndpoints = [
  '/api/health',
  '/api/modules',
  '/api/feedback/stats'
]

console.log('\n🔗 URL Construction Tests:')
testEndpoints.forEach(endpoint => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const fullUrl = API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint
  
  console.log(`  ${endpoint} -> ${fullUrl}`)
})

console.log('\n✅ API configuration test complete!')
console.log('\n📝 Expected behavior:')
console.log('  - Development: Uses proxy (empty API_BASE_URL)')
console.log('  - Production: Uses Render URL')
console.log('  - All endpoints should work with proper error handling') 
