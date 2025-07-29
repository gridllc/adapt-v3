// API Configuration
export const API_CONFIG = {
  // In development, use the Vite proxy (empty string means use relative URLs)
  // In production, this should be set to the actual API URL
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
  
  // Helper function to get the full API URL
  getApiUrl: (endpoint: string): string => {
    const base = API_CONFIG.BASE_URL
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return base ? `${base}${cleanEndpoint}` : cleanEndpoint
  }
}

// Common API endpoints
export const API_ENDPOINTS = {
  MODULES: '/api/modules',
  UPLOAD: '/api/upload',
  AI_ASK: '/api/ai/ask',
  TRANSCRIPT: (moduleId: string) => `/api/transcript/${moduleId}`,
  STEPS: (moduleId: string) => `/api/steps/${moduleId}`,
  VIDEO_URL: (filename: string) => `/api/video-url/${encodeURIComponent(filename)}`,
  HEALTH: '/api/health'
} as const 