# Quick Fix Guide - HTML Response Issue

## 🚨 Current Issue
The frontend is receiving HTML responses instead of JSON from API endpoints, causing `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` errors.

## 🔍 Root Cause
The frontend is running in development mode but trying to call the production Railway API, and the URL is missing the `https://` protocol.

## ✅ Quick Fix Options

### Option 1: Use Local Backend (Recommended)
1. **Start the local backend**:
   ```bash
   cd backend && npm start
   ```

2. **Start the frontend**:
   ```bash
   cd frontend && npm run dev
   ```

3. **Verify local backend is working**:
   ```bash
   curl http://localhost:8000/api/health
   ```

### Option 2: Force Production API (For Testing)
If you want to test against the production Railway API from local development:

1. **Create a `.env.local` file in the frontend directory**:
   ```bash
   cd frontend
   echo "VITE_FORCE_PRODUCTION_API=true" > .env.local
   ```

2. **Restart the frontend**:
   ```bash
   npm run dev
   ```

### Option 3: Set Production Environment Variable
If you want to use the production API permanently:

1. **Create a `.env.local` file in the frontend directory**:
   ```bash
   cd frontend
   echo "VITE_API_BASE_URL=https://adapt-v3-production.up.railway.app" > .env.local
   ```

2. **Restart the frontend**:
   ```bash
   npm run dev
   ```

## 🔧 Verification Steps

### Check API Configuration
Look for these console logs in the browser:
```
🔧 API Configuration: {
  mode: "development",
  isDevelopment: true,
  API_BASE_URL: "",
  ...
}
```

### Check API Calls
Look for these console logs:
```
🔗 API Call: {
  endpoint: "/api/modules",
  fullUrl: "/api/modules",  // Should be relative in dev
  ...
}
```

## 🎯 Expected Results

### For Local Development (Option 1)
- ✅ API calls go to `localhost:8000`
- ✅ Uses Vite proxy
- ✅ No HTML responses

### For Production API (Options 2 & 3)
- ✅ API calls go to `https://adapt-v3-production.up.railway.app`
- ✅ Full URLs with https://
- ✅ No HTML responses

## 🚨 If Still Getting HTML Responses

1. **Check the browser console** for the exact URL being called
2. **Verify the backend is running** (if using local)
3. **Clear browser cache** and hard refresh
4. **Check network tab** to see the actual response

## 📝 Files Modified
- `frontend/src/config/api.ts` - Enhanced with better error handling and debugging
- Added support for `VITE_FORCE_PRODUCTION_API` environment variable

## ✅ Status: Ready for Testing

Choose one of the three options above and the HTML response issue should be resolved. 