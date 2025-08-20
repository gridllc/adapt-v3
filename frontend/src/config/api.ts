// src/config/api.ts
export const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';

// Validate API configuration
if (!API_BASE) {
  console.warn('⚠️ VITE_API_BASE_URL not set - API calls will fail!')
} else if (!API_BASE.includes('adapt-v3.onrender.com') && !API_BASE.includes('localhost')) {
  console.warn('⚠️ VITE_API_BASE_URL may not be pointing to the correct backend!')
  console.warn('   Expected: https://adapt-v3.onrender.com')
  console.warn('   Current:', API_BASE)
}

// Log API configuration for debugging
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    API_BASE,
    hasBaseUrl: !!API_BASE,
    env: import.meta.env.VITE_API_BASE_URL
  })
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const fullUrl = `${API_BASE}${path}`
  
  if (import.meta.env.DEV) {
    console.log(`🌐 API Request: ${init?.method || 'GET'} ${fullUrl}`)
  }
  
  const r = await fetch(fullUrl, { 
    // TEMP: avoid cookie credentials while we harden CORS
    credentials: 'omit', 
    ...init 
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  get: <T = any>(path: string) => req<T>(path),
  post: <T = any>(path: string, body: any) =>
    req<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};

// Legacy exports for backward compatibility during cleanup
export const API_ENDPOINTS = {
  MODULES: '/api/modules',
  STEPS: (moduleId: string) => `/api/steps/${moduleId}`,
  TRANSCRIPT: (moduleId: string) => `/api/transcript/${moduleId}`,
  AI_ASK: '/api/ai/ask',
  HEALTH: '/api/health',
};

export const API_CONFIG = {
  baseURL: API_BASE,
  getApiUrl: (endpoint: string) => `${API_BASE}${endpoint}`,
};

// Legacy authenticatedApi for backward compatibility
export const authenticatedApi = async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
  return req<T>(endpoint, options);
};