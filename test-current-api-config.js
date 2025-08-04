#!/usr/bin/env node

/**
 * Test script to check current API configuration
 */

console.log('🧪 Testing Current API Configuration...\n')

// Simulate the current environment
const originalEnv = process.env
process.env.MODE = 'development'
process.env.VITE_API_BASE_URL = undefined

// Simulate the API configuration logic
const isDevelopment = process.env.MODE === 'development'
const PRODUCTION_API_URL = 'https://adapt-v3-production.up.railway.app'
const API_BASE_URL = process.env.VITE_API_BASE_URL || 
  (isDevelopment ? '' : PRODUCTION_API_URL)

console.log('🔧 Current Configuration:')
console.log(`  Mode: ${process.env.MODE}`)
console.log(`  Is Development: ${isDevelopment}`)
console.log(`  VITE_API_BASE_URL: ${process.env.VITE_API_BASE_URL}`)
console.log(`  API_BASE_URL: "${API_BASE_URL}"`)
console.log(`  PRODUCTION_API_URL: "${PRODUCTION_API_URL}"`)

// Test URL generation
const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  let fullUrl
  
  if (isDevelopment) {
    // In development, use proxy
    fullUrl = cleanEndpoint
  } else {
    // In production, use the full URL
    // If API_BASE_URL is empty, undefined, or "undefined", use the production URL
    const baseUrl = (API_BASE_URL && API_BASE_URL !== 'undefined') ? API_BASE_URL : PRODUCTION_API_URL
    fullUrl = `${baseUrl}${cleanEndpoint}`
  }
  
  // Ensure the URL has the correct protocol
  if (!isDevelopment && !fullUrl.startsWith('http')) {
    fullUrl = `https://${fullUrl}`
  }
  
  return fullUrl
}

console.log('\n🔗 URL Generation Tests:')
const testEndpoints = [
  '/api/modules',
  '/api/feedback/stats',
  '/api/health'
]

testEndpoints.forEach(endpoint => {
  const url = getApiUrl(endpoint)
  console.log(`  ${endpoint} → ${url}`)
})

console.log('\n🔍 Analysis:')
console.log('  - If you see URLs without https://, that\'s the problem')
console.log('  - Development should use relative URLs (e.g., "/api/modules")')
console.log('  - Production should use full URLs (e.g., "https://...")')

// Test what happens if we force production mode
console.log('\n🧪 Testing Production Mode:')
process.env.MODE = 'production'
const isDevelopmentProd = process.env.MODE === 'development'
const API_BASE_URL_PROD = process.env.VITE_API_BASE_URL || 
  (isDevelopmentProd ? '' : PRODUCTION_API_URL)

console.log(`  Production Mode - Is Development: ${isDevelopmentProd}`)
console.log(`  Production Mode - API_BASE_URL: "${API_BASE_URL_PROD}"`)

const getApiUrlProd = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  let fullUrl
  
  if (isDevelopmentProd) {
    fullUrl = cleanEndpoint
  } else {
    // If API_BASE_URL is empty, undefined, or "undefined", use the production URL
    const baseUrl = (API_BASE_URL_PROD && API_BASE_URL_PROD !== 'undefined') ? API_BASE_URL_PROD : PRODUCTION_API_URL
    fullUrl = `${baseUrl}${cleanEndpoint}`
  }
  
  if (!isDevelopmentProd && !fullUrl.startsWith('http')) {
    fullUrl = `https://${fullUrl}`
  }
  
  return fullUrl
}

testEndpoints.forEach(endpoint => {
  const url = getApiUrlProd(endpoint)
  console.log(`  ${endpoint} → ${url}`)
})

// Restore environment
process.env = originalEnv

console.log('\n✅ Test completed!') 