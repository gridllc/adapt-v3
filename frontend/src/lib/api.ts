// src/lib/api.ts
// One canonical API helper - use this everywhere instead of hand-built fetch URLs

// ✅ FIXED: Make the API base unambiguous (one place)
const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, ""); // no trailing slash

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  // If BASE is set, use it; otherwise default to relative /api
  return BASE ? `${BASE}${p}` : `/api${p}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

// convenience wrappers that always send cookies
export async function apiGet<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const r = await apiFetch(path, {
    method: "POST",
    body: body == null ? null : JSON.stringify(body),
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

// Retry helper for resilient API calls
export async function retry<T>(fn: () => Promise<T>, attempts = 3, backoff = 400): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { 
      return await fn(); 
    } catch (e) { 
      lastErr = e; 
      if (i === attempts - 1) throw lastErr; // Last attempt failed
    }
    await new Promise(r => setTimeout(r, backoff * (i + 1)));
  }
  throw lastErr;
}

// Log the resolved API base at startup
console.log("[API] VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL || "(not set)");
console.log("[API] BASE =", BASE || "(using relative /api)");
console.log("[API] window.location.origin =", typeof window !== 'undefined' ? window.location.origin : "(SSR)");
console.log("[API] Example URLs:");
console.log("  - /api/health ->", apiUrl("/api/health"));
console.log("  - /api/modules ->", apiUrl("/api/modules"));
