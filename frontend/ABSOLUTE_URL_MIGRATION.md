# Absolute API URL Migration - Complete

## Overview
Successfully migrated the frontend from relative API calls (`/api/...`) to absolute API calls using the Render backend URL (`https://adapt-v3.onrender.com/api/...`).

## Key Changes Made

### 1. Updated `frontend/src/config/api.ts`
- **Added absolute base URL**: `const DEFAULT_API = 'https://adapt-v3.onrender.com'`
- **Implemented URL constructor**: Uses `new URL(path, base)` to ensure absolute URLs
- **Maintained API structure**: Kept `api.get()`, `api.post()`, etc. methods for compatibility
- **Added fallback logic**: Falls back to Render backend if no environment variable is set

### 2. Updated API Calls in Components
Replaced all relative API calls with absolute ones:

#### TrainingPage.tsx
- ✅ Already using `API()` helper function (no changes needed)

#### ApiDebug.tsx
- `api('api/health')` → `api.get('api/health')`
- `api('api/modules')` → `api.get('api/modules')`

#### ChatTutor.tsx
- `api('api/ai/transcribe', {...})` → `api.post('api/ai/transcribe', {...})`

#### useModuleProcessing.ts
- `api(\`api/steps/${moduleId}\`)` → `api.get(\`api/steps/${moduleId}\`)`

#### useModuleAsk.ts
- `api.post('/api/ai/ask', {...})` → `api.post('api/ai/ask', {...})`

#### DashboardPage.tsx
- `authenticatedFetch(\`/api/modules/${id}\`, {...})` → `authenticatedFetch(\`api/modules/${id}\`, {...})`

#### useNetworkStatus.ts
- `safeFetch(\`/api/health\`, {...})` → `safeFetch(\`api/health\`, {...})`

#### DebugPage.tsx
- `api.get('/api/health')` → `api.get('api/health')`
- `url = '/api/debug/modules/debug?limit=50'` → `url = 'api/debug/modules/debug?limit=50'`

#### Feedback Components
- `api.post('/api/feedback/improvement', {...})` → `api.post('api/feedback/improvement', {...})`
- `api.post('/api/feedback/submit', {...})` → `api.post('api/feedback/submit', {...})`
- `api.get('/api/feedback/stats')` → `api.get('api/feedback/stats')`

#### Upload Components
- `url = '/api/upload'` → `url = 'api/upload'`
- `api.post('/api/upload/init', {...})` → `api.post('api/upload/init', {...})`
- `api.post('/api/upload/complete', {...})` → `api.post('api/upload/complete', {...})`

#### Step Components
- `api.post(\`/api/steps/${moduleId}\`, {...})` → `api.post(\`api/steps/${moduleId}\`, {...})`
- `api.post(\`/api/steps/${moduleId}/rewrite\`, {...})` → `api.post(\`api/steps/${moduleId}/rewrite\`, {...})`

#### Video Components
- `api.get(\`/api/video/${moduleId}/play\`)` → `api.get(\`api/video/${moduleId}/play\`)`

## Technical Implementation

### URL Construction
```typescript
const url = (path: string) => {
  const cleanPath = path.replace(/^\//, '');
  const base = API_BASE.endsWith('/') ? API_BASE : API_BASE + '/';
  return new URL(cleanPath, base).toString();
};
```

### API Base Logic
```typescript
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.origin.includes("onrender.com")
    ? window.location.origin
    : DEFAULT_API);
```

## Benefits

1. **Production Ready**: No more relative URL failures on production
2. **HTTPS Enforced**: All API calls now go to the secure Render backend
3. **Consistent Behavior**: Same API behavior across all environments
4. **Maintainable**: Single source of truth for API base URL
5. **Backward Compatible**: Existing code structure maintained

## Validation

- ✅ **Build Success**: `npm run build` completes without errors
- ✅ **Type Safety**: All TypeScript errors resolved
- ✅ **API Structure**: Maintained existing `api.get()`, `api.post()` methods
- ✅ **Absolute URLs**: All API calls now construct absolute URLs

## Testing Instructions

After deployment, test in browser console:

```javascript
// Should succeed (absolute URL)
await fetch('https://adapt-v3.onrender.com/api/health').then(r=>r.json())

// Should fail (relative URL - no longer used)
await fetch('/api/health').then(r=>r.text())
```

## Files Modified

- `frontend/src/config/api.ts` - Core API configuration
- `frontend/src/components/ApiDebug.tsx` - API testing component
- `frontend/src/components/ChatTutor.tsx` - Voice transcription
- `frontend/src/hooks/useModuleProcessing.ts` - Module status polling
- `frontend/src/hooks/useModuleAsk.ts` - AI question handling
- `frontend/src/pages/DashboardPage.tsx` - Module management
- `frontend/src/pages/DebugPage.tsx` - Debug interface
- `frontend/src/components/FeedbackSection.tsx` - User feedback
- `frontend/src/components/common/FeedbackWidget.tsx` - Feedback UI
- `frontend/src/components/common/FeedbackDashboard.tsx` - Admin feedback
- `frontend/src/utils/uploadFileWithProgress.ts` - File upload
- `frontend/src/utils/presignedUpload.ts` - S3 upload
- `frontend/src/components/StepEditor.tsx` - Step editing
- `frontend/src/hooks/useModuleStatus.ts` - Status checking
- `frontend/src/hooks/useSignedVideoUrl.ts` - Video URL generation

## Migration Complete ✅

All relative API calls have been successfully migrated to absolute URLs. The frontend now consistently uses the Render backend URL for all API requests, ensuring reliable operation in production.
