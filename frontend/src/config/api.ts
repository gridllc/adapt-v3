// Environment detection and API base URL configuration
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'
const RAILWAY_URL = 'https://adapt-v3-production.up.railway.app'

// Priority: env var > production URL > empty (for dev proxy)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (!isDevelopment ? RAILWAY_URL : '')

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
    return fullUrl
  }
}

export const API_ENDPOINTS = {
  MODULES: '/api/modules',
  STEPS: (moduleId: string) => `/api/steps/${moduleId}`,
  TRANSCRIPT: (moduleId: string) => `/api/transcript/${moduleId}`,
  VIDEO_URL: (filename: string) => `/api/video-url/${filename}`,
  AI_ASK: '/api/ai/ask',
  UPLOAD: '/api/upload',
  health: '/api/health',
  upload: '/api/upload', // Keep both for compatibility
}

export function apiUrl(endpoint: string): string {
  return API_CONFIG.getApiUrl(endpoint)
}

export async function api(endpoint: string, options?: RequestInit) {
  const url = apiUrl(endpoint)
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}