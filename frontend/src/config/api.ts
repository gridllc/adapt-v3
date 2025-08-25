// One place to build API URLs safely - ABSOLUTE ONLY
const DEFAULT_API = 'https://adaptord.com';

// Use env override if set, else use current origin (frontend domain), else fallback
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.origin) ||
  DEFAULT_API;

// CRITICAL: Build absolute URLs using URL constructor
const url = (path: string) => {
  // Remove leading slash to avoid double slashes
  const cleanPath = path.replace(/^\//, '');
  // Ensure API_BASE ends with slash for URL constructor
  const base = API_BASE.endsWith('/') ? API_BASE : API_BASE + '/';
  return new URL(cleanPath, base).toString();
};

// Export the base for debugging
export const API_BASE_URL = API_BASE;

// Main API function that builds absolute URLs
async function apiRequest(path: string, init: RequestInit = {}) {
  const reqUrl = url(path);
  
  // Get Clerk auth token if available
  let headers = { ...init?.headers };
  
  try {
    if (typeof window !== 'undefined' && window.Clerk?.session) {
      const token = await window.Clerk.session.getToken();
      if (token) {
        headers = {
          ...headers,
          'Authorization': `Bearer ${token}`,
        };
        console.log('🔑 Auth token included in request:', { path, tokenLength: token.length });
      } else {
        console.warn('⚠️ No auth token available for request:', path);
      }
    } else {
      console.warn('⚠️ Clerk not available for request:', path);
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }

  const r = await fetch(reqUrl, {
    ...init,
    credentials: init.credentials ?? 'include', // include cookies when not specified
    headers
  });
  
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// Main API object with methods (maintaining old structure)
export const api = {
  get: <T=any>(path: string) => 
    apiRequest(path, { method: 'GET' }),
  post: <T=any>(path: string, body: any) =>
    apiRequest(path, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    }),
  delete: <T=any>(path: string) =>
    apiRequest(path, { method: 'DELETE' }),
  put: <T=any>(path: string, body: any) =>
    apiRequest(path, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    }),
};

// Authenticated API with credentials and auth token
export const authenticatedApi = {
  get: <T=any>(path: string) => 
    apiRequest(path, { credentials: 'include' }),
  post: <T=any>(path: string, body: any) =>
    apiRequest(path, { 
      method: 'POST', 
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    }),
  delete: <T=any>(path: string) =>
    apiRequest(path, { 
      method: 'DELETE', 
      credentials: 'include'
    }),
  put: <T=any>(path: string, body: any) =>
    apiRequest(path, { 
      method: 'PUT', 
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    }),
};

// Legacy compatibility - but now builds absolute URLs
export const apiUrl = (path: string) => url(path);

// API configuration
export const API_CONFIG = {
  baseURL: API_BASE,
  timeout: 30000,
  retries: 3,
  getApiUrl: (endpoint: string) => url(endpoint)
};

// API endpoints (now used with the api() function)
export const API_ENDPOINTS = {
  MODULES: 'api/modules',
  UPLOAD: {
    INIT: 'api/upload/init',
    COMPLETE: 'api/upload/complete'
  },
  TRAINING: 'api/training',
  QA: 'api/qa/ask',
  STEPS: 'api/steps',
  AUTH: 'api/auth',
  HEALTH: 'health'
};

// Optional: quick check in console
if (typeof window !== 'undefined') (window as any).__API_BASE__ = API_BASE;

// Module data normalization utility
export interface NormalizedModule {
  id: string;
  title: string;
  filename: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  videoUrl?: string;
  steps?: Array<{ 
    id?: string; 
    text?: string; 
    startTime?: number; 
    endTime?: number; 
    order?: number 
  }>;
  transcriptText?: string;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  s3Key?: string;
  lastError?: string;
  transcriptJobId?: string;
}

export function normalizeModuleData(data: any): NormalizedModule {
  // Normalize: accept both {success:true, ...fields} and {module:{...}}
  const mod = data.module ? data.module : data;

  // Minimal validation to avoid "Invalid module data received"
  if (!mod?.id || typeof mod.status !== 'string') {
    throw new Error('Invalid module data received');
  }

  return mod as NormalizedModule;
}

export async function fetchModule(moduleId: string): Promise<NormalizedModule> {
  const res = await fetch(url(`api/modules/${moduleId}`), {
    credentials: 'include'
  });
  const data = await res.json();

  if (!res.ok || !data) throw new Error('Failed to load module');

  return normalizeModuleData(data);
}