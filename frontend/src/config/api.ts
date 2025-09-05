// API base URL - use relative paths in dev (proxy), full URL in production
const isDev = import.meta.env.MODE === 'development'

export const API_BASE = isDev
  ? '' // proxy will forward /api/* → backend
  : (import.meta.env.VITE_API_BASE_URL ?? 'https://adapt-v3.onrender.com')

// Debug logging (only in development)
if (isDev) {
  console.log('🔧 API Configuration:', {
    mode: import.meta.env.MODE,
    API_BASE,
    location: window.location.href
  })
}

// Simplified API URL builder
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE}${cleanEndpoint}`
}

// Legacy API_BASE_URL export for backward compatibility
export const API_BASE_URL = API_BASE

// API_CONFIG object for components that expect it
export const API_CONFIG = {
  baseURL: API_BASE,
  getApiUrl: getApiUrl,
  isDev: isDev
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

export async function authenticatedApi(endpoint: string, options?: RequestInit) {
  const url = getApiUrl(endpoint)
  
  // Add detailed logging
  console.log('🔍 [authenticatedApi] Making request:', {
    endpoint,
    fullUrl: url,
    method: options?.method || 'GET',
    baseURL: API_BASE,
    isDev
  })

  // Get Clerk token
  let token: string | null = null
  try {
    const { useAuth } = await import('@clerk/clerk-react')
    const { getToken } = useAuth()
    token = await getToken({ template: 'api' })
  } catch {}

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: buildHeaders(options, token || undefined),
    })
    clearTimeout(timeoutId)
    
    console.log('✅ [authenticatedApi] Response received:', {
      url,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    })

    const ct = res.headers.get('content-type') || ''
    const text = await res.text()
    
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
  const url = getApiUrl(endpoint)
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