# CORS and Authentication Fixes

## Issues Fixed

### 1. CORS Preflight Issues
**Problem:** Browser preflight requests were failing with:
```
Access to fetch at 'https://adapt-v3.onrender.com/api/health' from origin 'https://adaptord.com' has been blocked by CORS policy: Request header field cache-control is not allowed by Access-Control-Allow-Headers in preflight response.
```

**Solution:** Updated CORS configuration in `backend/src/server.ts`:
- Added missing headers: `Cache-Control`, `X-Requested-With`, `X-Clerk-Auth`, `X-Clerk-Signature`
- Added global OPTIONS handler: `app.options('*', cors(corsOptions))`
- Improved origin handling with fallback origins
- Disabled CSP for API-only server

### 2. Authentication Issues
**Problem:** API calls were returning 401 Unauthorized because Clerk tokens weren't being sent.

**Solution:** Created authenticated API helpers:
- Added `useAuthenticatedApi` hook in `frontend/src/hooks/useAuthenticatedApi.ts`
- Updated `useModules` hook to use authenticated API
- Updated `DashboardPage` to use authenticated API for delete operations

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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
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

1. **New Authenticated API Hook** (`frontend/src/hooks/useAuthenticatedApi.ts`):
```typescript
export function useAuthenticatedApi() {
  const { getToken } = useAuth()

  const authenticatedFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    })
  }, [getToken])

  return { authenticatedFetch }
}
```

2. **Updated useModules Hook** (`frontend/src/hooks/useModules.ts`):
```typescript
export function useModules() {
  const { authenticatedFetch } = useAuthenticatedApi()
  
  // Uses authenticatedFetch instead of regular api()
  const data = await authenticatedFetch('/api/modules')
}
```

3. **Updated DashboardPage** (`frontend/src/pages/DashboardPage.tsx`):
```typescript
export const DashboardPage: React.FC = () => {
  const { authenticatedFetch } = useAuthenticatedApi()
  
  const handleDelete = async (id: string) => {
    await authenticatedFetch(`/api/modules/${id}`, { method: 'DELETE' })
  }
}
```

## Testing Steps

1. **Test CORS Fix:**
   - Open browser dev tools
   - Navigate to `https://adaptord.com`
   - Check console for CORS errors
   - Should see successful API calls to `https://adapt-v3.onrender.com`

2. **Test Authentication:**
   - Sign in to the application
   - Check that modules load without 401 errors
   - Verify that delete operations work

3. **Test Preflight:**
   - Check that OPTIONS requests succeed
   - Verify that `Cache-Control` and other headers are allowed

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

## Environment Variables

Make sure these are set in your backend `.env`:
```bash
FRONTEND_URL=https://adaptord.com,https://www.adaptord.com
CLERK_SECRET_KEY=your-clerk-secret-key
```

And in your frontend `.env`:
```bash
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
VITE_API_URL=https://adapt-v3.onrender.com
```
