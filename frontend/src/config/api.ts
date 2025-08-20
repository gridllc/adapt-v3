// Hard-force same-origin in prod so the browser hits /api on adaptord.com
export const API_BASE = '';  // ← yes, empty string

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // uploads/status don't need cookies; keeps dev simple too
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'omit', ...init });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  get:  <T=any>(p: string) => req<T>(p),
  post: <T=any>(p: string, body: any) =>
    req<T>(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
};

// Optional: quick check in console
if (typeof window !== 'undefined') (window as any).__API_BASE__ = API_BASE;