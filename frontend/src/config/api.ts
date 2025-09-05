// frontend/src/config/api.ts

/**
 * Compute the absolute API URL for a given endpoint.
 * - Uses Vite env VITE_API_BASE_URL if set, otherwise falls back to '/api'
 * - Accepts absolute URLs unchanged
 */
export function getApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (window as any).__API_BASE_URL__ ||
    "/api";
  const b = String(base).replace(/\/+$/, "");
  const ep = String(endpoint).replace(/^\/+/, "");
  return `${b}/${ep}`;
}

/**
 * Minimal authenticated fetch wrapper.
 * - Tries to attach a Clerk JWT (JWT template "backend" if it exists)
 * - Uses Bearer tokens only (no cookies)
 * - Returns JSON if response is JSON; otherwise returns text
 * - Throws on non-2xx with helpful error message
 */
export async function authenticatedApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = getApiUrl(endpoint);

  // Merge headers & ensure Content-Type if sending a body
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach Clerk token if available (no React hooks used here)
  try {
    const clerk: any = (window as any).Clerk;
    const getToken: ((a?: any) => Promise<string | null | undefined>) | undefined =
      clerk?.session?.getToken;

    if (typeof getToken === "function") {
      // Prefer a JWT template named "backend" if you've created it in Clerk
      const token =
        (await getToken({ template: "backend" })) ??
        (await getToken()); // fallback if template not configured
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
  } catch (err) {
    // Non-fatal: routes using optionalAuth will still work without a token
    console.warn("[authenticatedApi] Could not get Clerk token:", err);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "omit", // using Bearer tokens, not cookies
  });

  // Fast path for success
  const ct = res.headers.get("content-type") || "";
  if (res.ok) {
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }

  // Build helpful error text
  let bodyText = "";
  try {
    bodyText = ct.includes("application/json")
      ? JSON.stringify(await res.json())
      : await res.text();
  } catch {
    /* ignore */
  }
  const msg = `API Error ${res.status}: ${bodyText || res.statusText}`;
  const err = new Error(msg);
  (err as any).status = res.status;
  (err as any).url = url;
  throw err;
}

/**
 * Helper for JSON POSTs:
 *   await postJson("/modules", { foo: "bar" })
 */
export function postJson(endpoint: string, data: unknown, init?: RequestInit) {
  return authenticatedApi(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
    ...(init || {}),
  });
}

/**
 * Helper for JSON GETs:
 *   await getJson("/modules")
 */
export function getJson(endpoint: string, init?: RequestInit) {
  return authenticatedApi(endpoint, {
    method: "GET",
    ...(init || {}),
  });
}
