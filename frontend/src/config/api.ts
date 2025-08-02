// Environment detection and API base URL configuration  
const isDevelopment = import.meta.env.MODE === 'development'
const RAILWAY_URL = 'https://adapt-v3-production.up.railway.app'

// Always use Railway URL in production, or env var if set
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isDevelopment ? '' : RAILWAY_URL)

// Force Railway URL in production if no env var is set
if (!isDevelopment && !import.meta.env.VITE_API_BASE_URL) {
  console.log('🚀 Production mode detected, using Railway URL')
}

// Fallback: if no env var and in production, force Railway URL
if (!import.meta.env.VITE_API_BASE_URL && !isDevelopment && !API_BASE_URL) {
  console.warn('No VITE_API_BASE_URL found, using Railway URL')
}

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
  AI_CONTEXTUAL_RESPONSE: '/api/ai/contextual-response'
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
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  console.log('📡 API response status:', response.status, response.statusText)
  
  if (!response.ok) {
    console.error('❌ API Error:', response.status, response.statusText)
    const errorText = await response.text()
    console.error('❌ Response body:', errorText)
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  console.log('📦 API response data:', data)
  
  return data
}