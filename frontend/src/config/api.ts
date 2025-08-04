// Environment detection and API base URL configuration  
const isDevelopment = import.meta.env.MODE === 'development'

// Production API URL - this should be set in Vercel environment variables
const PRODUCTION_API_URL = 'https://adapt-v3-production.up.railway.app'

// Force production API (for testing)
const FORCE_PRODUCTION_API = import.meta.env.VITE_FORCE_PRODUCTION_API === 'true'

// In development, use empty string to leverage Vite proxy
// In production, use the Railway URL or environment variable
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isDevelopment && !FORCE_PRODUCTION_API ? '' : PRODUCTION_API_URL)

// Debug logging
console.log('🔧 API Configuration:', {
  mode: import.meta.env.MODE,
  isDevelopment,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_FORCE_PRODUCTION_API: import.meta.env.VITE_FORCE_PRODUCTION_API,
  FORCE_PRODUCTION_API,
  API_BASE_URL,
  PRODUCTION_API_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
  location: window.location.href
})

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  getApiUrl: (endpoint: string): string => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    
    // In development, just return the endpoint (proxy will handle it)
    // In production, prepend the base URL
    let fullUrl: string
    
    if (isDevelopment && !FORCE_PRODUCTION_API) {
      // In development, use proxy
      fullUrl = cleanEndpoint
    } else {
      // In production or when forcing production API, use the full URL
      // If API_BASE_URL is empty, undefined, or "undefined", use the production URL
      const baseUrl = (API_BASE_URL && API_BASE_URL !== 'undefined') ? API_BASE_URL : PRODUCTION_API_URL
      fullUrl = `${baseUrl}${cleanEndpoint}`
    }
    
    // Ensure the URL has the correct protocol
    if (!isDevelopment && !fullUrl.startsWith('http')) {
      fullUrl = `https://${fullUrl}`
    }
    
    // Debug logging
    console.log('🔗 API Call:', {
      endpoint,
      cleanEndpoint,
      API_BASE_URL,
      fullUrl,
      isDevelopment,
      FORCE_PRODUCTION_API,
      mode: import.meta.env.MODE
    })
    
    return fullUrl
  }
}

export const API_ENDPOINTS = {
  MODULES: '/api/modules',
  UPLOAD: '/api/upload',
  STEPS: (moduleId: string) => `/api/steps/${moduleId}`,
  VIDEO_URL: (filename: string) => `/api/video-url/url/${filename}`,
  FEEDBACK_STATS: '/api/feedback/stats',
  AI_CONTEXTUAL_RESPONSE: '/api/ai/contextual-response',
  HEALTH: '/api/health',
  AI_ASK: '/api/ai/ask',
  TRANSCRIPT: (moduleId: string) => `/api/transcript/${moduleId}`
}

export function apiUrl(endpoint: string): string {
  return API_CONFIG.getApiUrl(endpoint)
}

export async function api(endpoint: string, options?: RequestInit) {
  const url = apiUrl(endpoint)
  
  console.log('🔗 API call to:', url)
  console.log('🔍 Environment check:', {
    mode: import.meta.env.MODE,
    isDevelopment: import.meta.env.MODE === 'development',
    API_BASE_URL,
    endpoint
  })
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    clearTimeout(timeoutId)
    console.log('📡 API response status:', response.status, response.statusText)
    
    // NEW: HTML Response Guard
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      console.error('❌ Received non-JSON response:', text.slice(0, 200))
      throw new Error(`Unexpected response format. Expected JSON, got: ${text.slice(0, 100)}...`)
    }
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', response.status, response.statusText)
      console.error('❌ Response body:', errorText)
      
      // Check if we got HTML instead of JSON
      if (errorText.startsWith('<!DOCTYPE html') || errorText.includes('<html')) {
        console.error('❌ Received HTML instead of JSON - possible wrong API endpoint or server error')
        throw new Error(`Server returned HTML instead of JSON. Check API endpoint: ${url}`)
      }
      
      // Special handling for 404 errors - return empty data instead of throwing
      if (response.status === 404 && endpoint.includes('/api/steps/')) {
        console.warn('⚠️ Steps not found, returning empty steps array')
        return { steps: [], success: false, error: 'Steps not found' }
      }
      
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    // Try to parse as JSON
    try {
      const parsed = await response.json()
      console.log('📦 API response data:', parsed)
      return parsed
    } catch (err) {
      console.error('❌ Failed to parse response as JSON')
      
      // This shouldn't happen now with the content-type check above
      throw new Error('Invalid JSON returned by server')
    }
    
  } catch (error) {
    console.error('❌ Network error:', error)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - server may be unavailable')
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Failed to fetch')) {
        throw new Error('Connection refused - backend server may not be running')
      }
    }
    
    throw error
  }
}

// Test function to verify API configuration
export async function testApiConnection() {
  try {
    console.log('🧪 Testing API connection...')
    const result = await api('/api/health')
    console.log('✅ API connection successful:', result)
    return true
  } catch (error) {
    console.error('❌ API connection failed:', error)
    return false
  }
}