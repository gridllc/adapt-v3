// src/lib/api.ts
// One canonical API helper - use this everywhere instead of hand-built fetch URLs

const RAW = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
export const API_BASE = RAW || ""; // "" -> same-origin

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE ? API_BASE : ""; // same-origin if not set
  return `${base}${p}`.replace(/([^:]\/)\/+/g, "$1"); // collapse //
}

// convenience wrappers that always send cookies
export async function apiGet<T>(path: string, init: RequestInit = {}) {
  const r = await fetch(apiUrl(path), { credentials: "include", ...init });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown, init: RequestInit = {}) {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
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
console.log("[API] base =", API_BASE || "(same-origin)");
console.log("[API] VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL || "(not set)");
console.log("[API] window.location.origin =", typeof window !== 'undefined' ? window.location.origin : "(SSR)");
