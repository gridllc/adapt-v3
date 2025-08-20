// src/config/api.ts
export const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
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
export const authenticatedApi = async (endpoint: string, options?: RequestInit) => {
  return req(endpoint, options);
};