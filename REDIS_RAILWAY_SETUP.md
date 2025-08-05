# Redis Railway Setup Guide

## ❌ **Current Issue:**
Your Railway deployment is trying to connect to `127.0.0.1:6379` (localhost) instead of Railway Redis.

## 🔍 **Root Cause:**
The environment variables are not set in Railway, so the Redis client is falling back to localhost.

## ✅ **Solution:**

### **1. Set Railway Environment Variables**

In your Railway dashboard, add these environment variables:

```bash
USE_REDIS=true
REDIS_URL=redis://default:password@host:port
DATABASE_URL=postgresql://postgres:password@host:port/database
```

### **2. Get Redis URL from Railway**

1. Go to your Railway project dashboard
2. Click on your Redis service
3. Copy the connection string (it looks like: `redis://default:password@host:port`)
4. Set this as your `REDIS_URL` environment variable

### **3. Verify Environment Variables**

Run this test locally to check your environment:
```bash
cd backend && node test-redis-env.js
```

### **4. Expected Output:**
```
🔍 Redis Environment Variables Test:
=====================================
USE_REDIS: true
REDIS_URL: SET
NODE_ENV: production
REDIS_URL preview: redis://default:password@...
```

## 🚀 **Deployment Steps:**

1. **Set Environment Variables** in Railway dashboard
2. **Redeploy** your application
3. **Check Logs** for Redis connection success
4. **Test Health Endpoint** at `/api/health`

## 🔧 **Debugging:**

If you still see localhost errors after setting environment variables:

1. **Check Railway Logs** - Look for the debug output we added
2. **Verify Environment Variables** - Make sure they're set correctly
3. **Redeploy** - Environment changes require a redeploy
4. **Test Connection** - Use the health endpoint to verify

## 📋 **Environment Variables Checklist:**

- [ ] `USE_REDIS=true`
- [ ] `REDIS_URL=redis://default:password@host:port`
- [ ] `DATABASE_URL=postgresql://postgres:password@host:port/database`
- [ ] `NODE_ENV=production`

Once these are set correctly, Redis should connect to Railway instead of localhost! 🎉 