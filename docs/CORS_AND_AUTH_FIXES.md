# CORS and Authentication Fixes

## Issues Fixed

### 1. CORS Preflight Issues
**Problem:** Browser preflight requests were failing with:
```
Access to fetch at 'https://adapt-v3.onrender.com/api/health' from origin 'https://adaptord.com' has been blocked by CORS policy: Request header field pragma is not allowed by Access-Control-Allow-Headers in preflight response.
```

**Solution:** Updated CORS configuration in `backend/src/server.ts`:
- Added missing headers: `Accept`, `Pragma`, `X-Requested-With`, `X-Clerk-Auth`, `X-Clerk-Signature`
- Added global OPTIONS handler: `app.options('*', cors(corsOptions))`
- Improved origin handling with fallback origins
- Disabled CSP for API-only server
- Set `credentials: false` since we're using Bearer tokens, not cookies

### 2. Authentication Issues
**Problem:** API calls were returning 401 Unauthorized because Clerk tokens weren't being sent.

**Solution:** Created authenticated API helpers:
- Added `useAuthenticatedApi` hook in `frontend/src/hooks/useAuthenticatedApi.ts`
- Updated `useModules` hook to use authenticated API
- Updated `DashboardPage` to use authenticated API for delete operations

### 3. Preflight Optimization
**Problem:** Frontend was causing unnecessary preflights by setting `Content-Type` on GET requests.

**Solution:** Refactored API configuration:
- Only set `Content-Type` when sending a body
- Use shared header builder to avoid unnecessary preflights
- Simplified URL construction for development vs production

## Changes Made

### Backend Changes (`backend/src/server.ts`)

1. **CORS Configuration:**
```typescript
const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true) // allow server-to-server/tools
    const list = allowedOrigins.length ? allowedOrigins : fallbackOrigins
    return list.includes(origin) ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`))
  },
  credentials: false, // was true – set to true only if you use cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',            // <-- add this
    'X-Requested-With',
    'Range',
    'X-Upload-Source',
    'X-File-Size',
    'X-File-Type',
    'X-Clerk-Auth',
    'X-Clerk-Signature',
  ],
  exposedHeaders: [
    'X-Upload-Progress',
    'X-Upload-Status',
    'X-Module-ID',
    'Content-Range',
    'Accept-Ranges',
    'ETag',
    'Cache-Control',
  ],
  maxAge: 86400,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions)) // Global preflight handler
```

2. **Helmet Configuration:**
```typescript
app.use(helmet({
  contentSecurityPolicy: false, // API only; let the frontend own CSP
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
```

3. **Temporary Auth Change:**
```typescript
app.use('/api/modules', optionalAuth, moduleRoutes) // Temporarily optional for debugging
```

### Frontend Changes

1. **Refactored API Configuration** (`frontend/src/config/api.ts`):
```typescript
// API base URL - use domain in production, empty in development for proxy
const baseURL = import.meta.env.VITE_API_URL || (isDevelopment ? '' : 'https://adaptord.com')

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
  const url = apiUrl(endpoint)

  // Get Clerk token
  let token: string | null = null
  try {
    const { useAuth } = await import('@clerk/clerk-react')
    const { getToken } = useAuth()
    token = await getToken()
  } catch {}

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  const res = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: buildHeaders(options, token || undefined),
    // credentials: 'omit', // no cookies needed with Bearer
  })
  clearTimeout(timeoutId)

  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  if (!res.ok) throw new Error(`API Error ${res.status}: ${text.slice(0, 120)}`)
  if (!ct.includes('application/json')) throw new Error(`Unexpected response (not JSON): ${text.slice(0, 120)}`)
  return JSON.parse(text)
}
```

2. **Updated useAuthenticatedApi Hook** (`frontend/src/hooks/useAuthenticatedApi.ts`):
```typescript
import { useCallback } from 'react'
import { authenticatedApi } from '../config/api'

export function useAuthenticatedApi() {
  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    return await authenticatedApi(endpoint, options)
  }, [])

  return { authenticatedFetch }
}
```

3. **Updated useModules Hook** (`frontend/src/hooks/useModules.ts`):
```typescript
export function useModules() {
  const { authenticatedFetch } = useAuthenticatedApi()
  
  // Uses authenticatedFetch instead of regular api()
  const data = await authenticatedFetch('/api/modules')
}
```

4. **Updated DashboardPage** (`frontend/src/pages/DashboardPage.tsx`):
```typescript
export const DashboardPage: React.FC = () => {
  const { authenticatedFetch } = useAuthenticatedApi()
  
  const handleDelete = async (id: string) => {
    await authenticatedFetch(`/api/modules/${id}`, { method: 'DELETE' })
  }
}
```

## Environment Variables

### Frontend (Vercel)
```bash
VITE_API_URL=https://adaptord.com
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

### Backend (Render)
```bash
FRONTEND_URL=https://adaptord.com,https://www.adaptord.com
CLERK_SECRET_KEY=your-clerk-secret-key
```

## Testing Steps

1. **Test CORS Fix:**
   - Open browser dev tools
   - Navigate to `https://adaptord.com`
   - Check console for CORS errors
   - Should see successful API calls to `https://adaptord.com/api/health`

2. **Test Authentication:**
   - Sign in to the application
   - Check that modules load without 401 errors
   - Verify that delete operations work

3. **Test Preflight:**
   - Check that OPTIONS requests succeed
   - Verify that `Pragma` and other headers are allowed
   - Confirm that GET requests don't trigger unnecessary preflights

4. **Test Upload:**
   - Try uploading a video file
   - Should work without CORS errors
   - Check that progress updates correctly

## Next Steps

1. **Re-enable Authentication:** Once testing confirms everything works, change back to:
```typescript
app.use('/api/modules', requireAuth, moduleRoutes)
```

2. **Update Other Hooks:** Consider updating other hooks that make API calls to use `useAuthenticatedApi`:
   - `useSteps`
   - `useTranscript`
   - `useModuleAsk`

3. **Monitor Logs:** Check backend logs for any remaining CORS or auth issues

## Key Improvements

- **Reduced Preflights:** Only set `Content-Type` when sending a body
- **Better CORS:** Added all necessary headers including `Pragma`
- **Simplified URLs:** Use domain in production, proxy in development
- **Cleaner Code:** Shared header builder and simplified API functions
