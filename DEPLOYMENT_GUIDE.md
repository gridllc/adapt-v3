# Deployment Guide - API Configuration Fix

## 🚨 Critical Issue Resolved
The frontend was receiving HTML responses instead of JSON due to incorrect API routing in production.

## ✅ Fixes Implemented

### 1. **Enhanced API Error Handling** (`frontend/src/config/api.ts`)
- Added HTML response detection before JSON parsing
- Better error messages for debugging
- Content-type validation to prevent HTML parsing errors

### 2. **Vercel Configuration** (`frontend/vercel.json`)
- Added API route rewrites to prevent auto-routing to index.html
- Configured proper CORS headers
- Set up proxy to Railway backend

### 3. **Environment Variable Configuration**

#### For Development (Local)
```bash
# No environment variables needed - uses Vite proxy
npm run dev
```

#### For Production (Vercel)
**CRITICAL**: Set these environment variables in Vercel:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variable:

```
Name: VITE_API_BASE_URL
Value: https://adapt-v3-production.up.railway.app
Environment: Production
```

### 4. **Backend Verification**
All required endpoints are properly configured:
- ✅ `/api/modules` - Module management
- ✅ `/api/feedback/stats` - Feedback statistics  
- ✅ `/api/health` - Health check
- ✅ `/api/steps/:moduleId` - Step management
- ✅ `/api/upload` - File upload
- ✅ `/api/ai/*` - AI services

## 🔧 Testing Steps

### 1. **Local Development Testing**
```bash
# Terminal 1: Start backend
cd backend && npm start

# Terminal 2: Start frontend  
cd frontend && npm run dev
```

**Expected Console Logs:**
```
🔧 API Configuration: {
  mode: "development",
  isDevelopment: true,
  API_BASE_URL: "",
  ...
}
🔗 API Call: {
  endpoint: "/api/modules",
  fullUrl: "/api/modules",
  ...
}
📦 API response data: { success: true, modules: [...] }
```

### 2. **Production Testing**
After setting `VITE_API_BASE_URL` in Vercel:

**Expected Console Logs:**
```
🔧 API Configuration: {
  mode: "production", 
  isDevelopment: false,
  API_BASE_URL: "https://adapt-v3-production.up.railway.app",
  ...
}
🔗 API Call: {
  endpoint: "/api/modules",
  fullUrl: "https://adapt-v3-production.up.railway.app/api/modules",
  ...
}
```

## 🚨 Common Issues & Solutions

### Issue: Still Getting HTML Responses
**Cause**: Missing `VITE_API_BASE_URL` environment variable in production
**Solution**: Set the environment variable in Vercel dashboard

### Issue: CORS Errors
**Cause**: Frontend trying to call backend directly
**Solution**: Vercel configuration should handle this via rewrites

### Issue: 404 Errors
**Cause**: Backend routes not properly configured
**Solution**: Verify backend is running and routes are mounted

## 📝 Files Modified

1. **`frontend/src/config/api.ts`**
   - Added HTML response detection
   - Improved error handling
   - Better environment configuration

2. **`frontend/vercel.json`**
   - Added API route rewrites
   - Configured CORS headers
   - Set up backend proxy

3. **`frontend/src/hooks/*.ts`**
   - Updated all hooks to use robust `api()` function
   - Removed direct `fetch()` calls

4. **`frontend/src/components/common/FeedbackWidget.tsx`**
   - Fixed API usage (removed redundant `.json()` call)

## 🎯 Expected Results

### Before Fix
- ❌ `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
- ❌ HTML responses from API endpoints
- ❌ Failed module loading
- ❌ Failed feedback dashboard

### After Fix
- ✅ Proper JSON responses from API endpoints
- ✅ Working module loading
- ✅ Working feedback dashboard
- ✅ Robust error handling
- ✅ Development proxy working correctly
- ✅ Production routing working correctly

## 🔄 Deployment Checklist

### For Local Development
- [ ] Backend running on `localhost:8000`
- [ ] Frontend running on `localhost:5177` (or similar)
- [ ] Vite proxy configured in `vite.config.ts`
- [ ] Console shows correct API configuration logs

### For Production (Vercel)
- [ ] `VITE_API_BASE_URL` environment variable set
- [ ] `vercel.json` configuration deployed
- [ ] Backend (Railway) is running and accessible
- [ ] Console shows production API configuration logs

## 🧪 Verification Commands

### Test Backend Endpoints
```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/modules
curl http://localhost:8000/api/feedback/stats
```

### Test Frontend API Configuration
```bash
node test-api-fix.js
```

## ✅ Status: Ready for Deployment

All API configuration issues have been resolved. The application should now work correctly in both development and production environments. 