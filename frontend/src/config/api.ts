// Environment detection and API base URL configuration  
const isDevelopment = import.meta.env.MODE === 'development'

// API base URL - use domain in production, empty in development for proxy
const baseURL = import.meta.env.VITE_API_BASE_URL || (isDevelopment ? '' : 'https://adapt-v3.onrender.com')

// Export the API base URL
export const API_BASE_URL = baseURL

// Debug logging
console.log('🔧 API Configuration:', {
  mode: import.meta.env.MODE,
  isDevelopment,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  API_BASE_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
  location: window.location.href
})

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  getApiUrl: (endpoint: string): string => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    
    // In development, use proxy (empty base URL)
    // In production, use the full URL from environment variable
    if (isDevelopment && API_BASE_URL === '') {
      return cleanEndpoint
    } else {
      return `${API_BASE_URL}${cleanEndpoint}`
    }
  }
}

export const API_ENDPOINTS = {
  MODULES: '/api/modules',
  UPLOAD: '/api/upload',
  STEPS: (moduleId: string) => `/api/steps/${moduleId}`,
  VIDEO_URL: (filename: string) => `/api/video-url/url/${filename}`, // LEGACY
  VIDEO_URL_BY_MODULE: (moduleId: string) => `/api/video-url/module/${moduleId}`, // NEW
  FEEDBACK_STATS: '/api/feedback/stats',
  AI_CONTEXTUAL_RESPONSE: '/api/ai/contextual-response',
  HEALTH: '/api/health',
  AI_ASK: '/api/ai/ask',
  TRANSCRIPT: (moduleId: string) => `/api/transcript/${moduleId}`,
  AI_LEARNING_METRICS: '/api/ai/learning-metrics'
}

export function apiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return isDevelopment && API_BASE_URL === '' ? clean : `${API_BASE_URL}${clean}`
}

// Shared header builder to avoid unnecessary preflights
function buildHeaders(options?: RequestInit, token?: string): HeadersInit {
  const headers: Record<string, string> = {}

  // Only set Content-Type when sending a body
  const method = (options?.method || 'GET').toUpperCase()
  if (options?.body && !('Content-Type' in (options?.headers || {}))) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) headers['Authorization'] = `Bearer ${token}`
  // Merge caller headers last
  return { ...headers, ...(options?.headers as any) }
}

import { useAuth } from "@clerk/clerk-react";

export function useAuthenticatedApi() {
  const { getToken, isSignedIn } = useAuth();

  return async (input: RequestInfo, init: RequestInit = {}) => {
    if (!isSignedIn) throw new Error("Not signed in");

    // Ensure you're really attaching the Clerk session token:
    const token = await getToken({ template: "default" });
    if (!token) throw new Error("No Clerk token available");

    // Add logging:
    console.log("🔑 Clerk token:", token?.slice(0,10));

    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // credentials not required when you send Bearer tokens:
      // credentials: "omit",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API Error ${res.status}: ${text}`);
    }
    return res.json();
  };
}

// Legacy function for backward compatibility
export async function authenticatedApi(endpoint: string, options?: RequestInit) {
  // This will be replaced by the hook-based approach
  throw new Error("Use useAuthenticatedApi hook instead of authenticatedApi function")
}

export async function api(endpoint: string, options?: RequestInit) {
  const url = apiUrl(endpoint)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  const res = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: buildHeaders(options),
    // credentials: 'omit',
  })
  clearTimeout(timeoutId)

  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`API Error ${res.status}: ${text.slice(0, 120)}`)
  if (!ct.includes('application/json')) throw new Error(`Unexpected response (not JSON): ${text.slice(0, 120)}`)
  return JSON.parse(text)
}

// Test function to verify API connection
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