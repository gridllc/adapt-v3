// src/config/api.ts
// Use relative URLs - Vercel will proxy /api/* to Render backend
export const API_BASE = '';

// Log API configuration for debugging
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    API_BASE,
    hasBaseUrl: !!API_BASE,
    proxy: 'Vercel will proxy /api/* to Render backend'
  })
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // Use relative URLs - Vercel will proxy to Render backend
  const fullUrl = path.startsWith('/') ? path : `/${path}`
  
  if (import.meta.env.DEV) {
    console.log(`🌐 API Request: ${init?.method || 'GET'} ${fullUrl}`)
  }
  
  const r = await fetch(fullUrl, { 
    // No CORS needed - same origin via Vercel proxy
    credentials: 'include', 
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
  getApiUrl: (endpoint: string) => endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
};

// Legacy authenticatedApi for backward compatibility
export const authenticatedApi = async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
  return req<T>(endpoint, options);
};