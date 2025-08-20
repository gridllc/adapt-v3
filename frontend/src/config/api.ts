// src/config/api.ts
const onProd =
  typeof window !== 'undefined' &&
  /(^|\.)adaptord\.com$/i.test(window.location.hostname);

export const API_BASE = onProd
  ? '' // ← force same-origin in prod (Vercel will proxy to Render)
  : ((import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:10000');

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // No cookies needed for upload/status; avoid CORS complexity in dev too
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'omit', ...init });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  get:  <T=any>(p: string) => req<T>(p),
  post: <T=any>(p: string, body: any) =>
    req<T>(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
};

// Expose for quick verification in devtools
if (typeof window !== 'undefined') (window as any).__API_BASE__ = API_BASE;