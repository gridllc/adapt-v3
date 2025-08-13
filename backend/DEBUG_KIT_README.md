# 🔍 Debug Kit - Comprehensive Observability

This debug kit provides hard observability to identify exactly where the video processing pipeline breaks.

## 🚀 Quick Start

### 1. Backend Deep Probe
Test a module's health in one call:
```bash
curl -s http://localhost:8000/api/debug/module/YOUR_MODULE_ID | jq
```

### 2. Frontend Video Debug
Replace your video player temporarily:
```tsx
import { VideoDebugEvents } from '../components/VideoDebugEvents'
import { useStepsProbe } from '../hooks/useStepsProbe'

// In your component:
useStepsProbe(moduleId) // Add this hook
<VideoDebugEvents src={videoUrl} /> // Replace your video player
```

## 🔧 What Each Component Does

### Backend: `/api/debug/module/:id`
**Deep health probe** that checks:
1. **Database** → Module exists and status
2. **S3 HEAD** → File exists and metadata
3. **Presign** → Signed URL generation
4. **Range GET** → Proves Range support & CORS
5. **Steps** → AI-generated steps count
6. **Job Status** → Queue/worker status

**Expected Response:**
```json
{
  "ok": true,
  "traceId": "abc123",
  "module": {
    "id": "module-id",
    "status": "ready",
    "s3Key": "videos/abc.mp4",
    "contentLength": 1234567,
    "contentType": "video/mp4"
  },
  "s3": { "rangeOK": true, "headOk": true },
  "steps": { "count": 5 },
  "job": { "status": "ready", "progress": 100 }
}
```

### Frontend: VideoDebugEvents
**Logs all video events** to console:
- `loadstart`, `loadedmetadata`, `loadeddata`
- `canplay`, `canplaythrough` ← **Key indicators**
- `play`, `playing`, `pause`
- `seeking`, `seeked`, `waiting`, `stalled`
- `error` ← **Check for media errors**

**Expected Console Output:**
```
[VIDEO] loadstart      t=n/a readyState=0 src=https://...
[VIDEO] loadedmetadata t=n/a readyState=1 src=https://...
[VIDEO] loadeddata     t=n/a readyState=2 src=https://...
[VIDEO] canplay        t=0.000 readyState=3 src=https://...
[VIDEO] canplaythrough t=0.000 readyState=4 src=https://...
```

### Frontend: useStepsProbe
**Explicit steps fetching** with error surfacing:
- Logs every steps fetch attempt
- Shows success/failure clearly
- Correlates with backend probe

## 🧪 Testing Commands

### A. Deep Probe (Backend)
```bash
# Test with real module ID
curl -s http://localhost:8000/api/debug/module/6291c265-bcc9-42a5-95c4-77cc139244df | jq

# Look for:
# - s3.headOk: true
# - s3.rangeOK: true  
# - steps.count: > 0
# - module.status: "ready" (not "processing")
```

### B. Range GET Test (S3 Compatibility)
```bash
# Get signed URL from probe, then test Range support
curl -sI "PASTE_SIGNED_URL_HERE" -H "Range: bytes=0-1023"

# Expect: HTTP/1.1 206 Partial Content
# If you get 200 or 403, Range support is broken
```

### C. Frontend Console
1. Open browser dev tools
2. Look for `[VIDEO]` and `[AI DEBUG]` logs
3. Check for `canplaythrough` event
4. Look for steps probe results

## 🔍 Common Issues & Solutions

### Issue: Steps Stay Empty
**Check:**
1. Backend probe: `steps.count` should be > 0
2. Module status: Should be "ready", not "processing"
3. AI processing: Check for errors in backend logs

**Debug:**
```bash
# Check module status
curl -s http://localhost:8000/api/debug/module/YOUR_ID | jq '.module.status'

# Check steps directly
curl -s http://localhost:8000/api/steps/YOUR_ID | jq
```

### Issue: Video Player Flaky
**Check:**
1. Frontend console: Look for `[VIDEO]` events
2. Missing `canplaythrough` = Range/CORS issue
3. Backend probe: `s3.rangeOK` should be true

**Debug:**
```bash
# Test Range support directly
curl -sI "SIGNED_URL" -H "Range: bytes=0-1023"

# Check CORS headers
curl -sI "SIGNED_URL" | grep -i cors
```

### Issue: S3 Access Denied
**Check:**
1. Backend probe: `s3.headOk` should be true
2. Environment variables: AWS credentials set
3. Bucket permissions: Object exists and accessible

**Debug:**
```bash
# Check S3 config
curl -s http://localhost:8000/api/debug/s3 | jq

# Test S3 connection
curl -s http://localhost:8000/api/debug/s3-test | jq
```

## 📊 Correlation with TraceId

Every request gets a `traceId` for correlation:

1. **Upload** → Look for `[REQ abc123] POST /api/upload`
2. **Probe** → Look for `[DEBUG abc123] start`
3. **AI Processing** → Look for `[AI DEBUG]` logs
4. **Frontend** → Look for `[AI DEBUG]` and `[VIDEO]` logs

**Example Correlation:**
```
[REQ abc123] POST /api/upload
[DEBUG abc123] start moduleId=6291c265-bcc9-42a5-95c4-77cc139244df
[AI DEBUG] steps probe start moduleId=6291c265-bcc9-42a5-95c4-77cc139244df
[VIDEO] canplaythrough t=0.000 readyState=4
```

## 🚨 Emergency Debug Mode

If everything is broken, enable verbose logging:

```bash
# Backend: Set environment variable
export DEBUG_LEVEL=verbose

# Frontend: Add to console
localStorage.setItem('debug', 'true')
```

## 📝 Next Steps After Debug

1. **Identify the breaking point** using the probe
2. **Check specific service** (S3, AI, Database)
3. **Verify environment** variables and permissions
4. **Test individual components** in isolation
5. **Fix the root cause** rather than symptoms

## 🔗 Related Endpoints

- `/api/debug/module/:id` - Module health probe
- `/api/debug/s3` - S3 configuration check
- `/api/debug/s3-test` - S3 connection test
- `/api/steps/:id` - Direct steps fetch
- `/api/status/:id` - Module status check

---

**Remember:** The debug kit gives you **hard data**, not guesses. Use it to pinpoint exactly where the pipeline breaks!
