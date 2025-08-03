// Environment detection and API base URL configuration  
const isDevelopment = import.meta.env.MODE === 'development'
const RAILWAY_URL = 'https://adapt-v3-production.up.railway.app'

// Use proxy in development, Railway URL in production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isDevelopment ? '' : RAILWAY_URL)

// Debug logging
console.log('🔧 API Configuration:', {
  mode: import.meta.env.MODE,
  isDevelopment,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  API_BASE_URL,
  RAILWAY_URL
})

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  getApiUrl: (endpoint: string): string => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const fullUrl = API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint
    
    // Debug logging
    console.log('🔗 API Call:', {
      endpoint,
      cleanEndpoint,
      API_BASE_URL,
      fullUrl,
      isDevelopment,
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
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Response body:', errorText)
      
      // Special handling for 404 errors - return empty data instead of throwing
      if (response.status === 404 && endpoint.includes('/api/steps/')) {
        console.warn('⚠️ Steps not found, returning empty steps array')
        return { steps: [], success: false, error: 'Steps not found' }
      }
      
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('📦 API response data:', data)
    
    return data
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