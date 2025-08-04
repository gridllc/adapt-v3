#!/usr/bin/env node

/**
 * Test script to verify API configuration fix
 */

console.log('🧪 Testing API Configuration Fix...\n')

// Simulate the environment variables
const originalEnv = process.env
process.env.MODE = 'development'
process.env.VITE_API_BASE_URL = undefined

// Simulate the API configuration logic
const isDevelopment = process.env.MODE === 'development'
const API_BASE_URL = process.env.VITE_API_BASE_URL || 
  (isDevelopment ? '' : 'https://adapt-v3-production.up.railway.app')

console.log('🔧 Environment Configuration:')
console.log(`  Mode: ${process.env.MODE}`)
console.log(`  Is Development: ${isDevelopment}`)
console.log(`  VITE_API_BASE_URL: ${process.env.VITE_API_BASE_URL}`)
console.log(`  API_BASE_URL: "${API_BASE_URL}"`)

// Test URL generation
const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const fullUrl = isDevelopment ? cleanEndpoint : `${API_BASE_URL}${cleanEndpoint}`
  return fullUrl
}

console.log('\n🔗 URL Generation Tests:')
const testEndpoints = [
  '/api/modules',
  '/api/feedback/stats',
  '/api/health',
  'api/modules' // without leading slash
]

testEndpoints.forEach(endpoint => {
  const url = getApiUrl(endpoint)
  console.log(`  ${endpoint} → ${url}`)
})

console.log('\n✅ Expected Behavior:')
console.log('  ✅ In development: endpoints should be relative (e.g., "/api/modules")')
console.log('  ✅ In production: endpoints should be absolute (e.g., "https://.../api/modules")')
console.log('  ✅ Vite proxy should handle development requests')
console.log('  ✅ No more HTML responses in development')

console.log('\n🎯 Next Steps:')
console.log('  1. Restart the frontend development server')
console.log('  2. Check browser console for API configuration logs')
console.log('  3. Verify API calls work without HTML responses')
console.log('  4. Test feedback dashboard and modules loading')

// Restore environment
process.env = originalEnv

console.log('\n✅ API configuration fix is ready for testing!') 