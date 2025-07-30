// Automatically detect environment and set API base URL
const isDevelopment = import.meta.env.DEV
const RAILWAY_URL = 'https://adapt-v3-production.up.railway.app'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isDevelopment ? '' : RAILWAY_URL)

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  getApiUrl: (endpoint: string): string => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint
  }
}

export const API_ENDPOINTS = {
  MODULES: '/api/modules',
  STEPS: (moduleId: string) => `/api/steps/${moduleId}`,
  TRANSCRIPT: (moduleId: string) => `/api/transcript/${moduleId}`,
  VIDEO_URL: (filename: string) => `/api/video-url/${filename}`,
  AI_ASK: '/api/ai/ask',
  health: '/api/health',
  upload: '/api/upload',
}

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint
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
    throw new Error(`API Error: ${response.statusText}`)
  }
  
  return response.json()
}