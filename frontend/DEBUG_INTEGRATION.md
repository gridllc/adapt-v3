# 🔍 Frontend Debug Integration

Quick integration guide for the debug components.

## 🚀 Quick Integration

### 1. Add Video Debug Events
Replace your video player temporarily with the debug version:

```tsx
// Before (your current player)
<video src={videoUrl} controls />

// After (debug version)
import { VideoDebugEvents } from '../components/VideoDebugEvents'
<VideoDebugEvents src={videoUrl} />
```

### 2. Add Steps Probe Hook
Add the steps probe to your TrainingPage or wherever you fetch steps:

```tsx
import { useStepsProbe } from '../hooks/useStepsProbe'

export function TrainingPage({ moduleId }: { moduleId: string }) {
  // Add this hook - it will log every steps fetch attempt
  useStepsProbe(moduleId)
  
  // ... rest of your component
}
```

## 🔍 What You'll See in Console

### Video Events (from VideoDebugEvents)
```
[VIDEO] loadstart      t=n/a readyState=0 src=https://...
[VIDEO] loadedmetadata t=n/a readyState=1 src=https://...
[VIDEO] loadeddata     t=n/a readyState=2 src=https://...
[VIDEO] canplay        t=0.000 readyState=3 src=https://...
[VIDEO] canplaythrough t=0.000 readyState=4 src=https://...
```

**Key Indicators:**
- ✅ `canplaythrough` = Video is ready to play
- ❌ Missing `canplaythrough` = Range/CORS issue
- ❌ `error` event = Media error (check network tab)

### Steps Probe (from useStepsProbe)
```
[AI DEBUG] steps probe start moduleId=abc123
[AI DEBUG] steps probe ok count=5
```

**Key Indicators:**
- ✅ `steps probe ok count=X` = Steps loaded successfully
- ❌ `steps probe failed` = API error
- ❌ `steps probe error` = Network/exception error

## 🧪 Testing Commands

### Test Backend Health
```bash
# Replace YOUR_MODULE_ID with actual ID from upload response
curl -s http://localhost:8000/api/debug/module/YOUR_MODULE_ID | jq

# Look for:
# - "ok": true
# - "s3": { "rangeOK": true }
# - "steps": { "count": > 0 }
```

### Test Frontend
1. Open browser dev tools
2. Upload a video
3. Watch console for `[VIDEO]` and `[AI DEBUG]` logs
4. Check if `canplaythrough` appears
5. Check if steps probe succeeds

## 🔍 Common Frontend Issues

### Video Won't Play
**Check Console:**
- Missing `canplaythrough` event
- `error` event with media error
- Network tab for failed requests

**Debug:**
```bash
# Test Range support
curl -sI "SIGNED_URL" -H "Range: bytes=0-1023"
# Should return: HTTP/1.1 206 Partial Content
```

### Steps Never Load
**Check Console:**
- `[AI DEBUG] steps probe failed`
- `[AI DEBUG] steps probe error`

**Debug:**
```bash
# Check backend directly
curl -s http://localhost:8000/api/steps/YOUR_MODULE_ID | jq
```

### CORS Issues
**Check Console:**
- CORS errors in network tab
- Failed preflight requests

**Debug:**
```bash
# Check CORS headers
curl -sI "SIGNED_URL" | grep -i cors
```

## 📊 Correlation Example

**Complete Flow:**
```
1. [REQ abc123] POST /api/upload
2. [DEBUG abc123] start moduleId=def456
3. [AI DEBUG] steps probe start moduleId=def456
4. [VIDEO] canplaythrough t=0.000 readyState=4
5. [AI DEBUG] steps probe ok count=5
```

**If Broken:**
```
1. [REQ abc123] POST /api/upload ✅
2. [DEBUG abc123] start moduleId=def456 ✅
3. [AI DEBUG] steps probe start moduleId=def456 ✅
4. [VIDEO] error t=n/a readyState=0 ❌
5. [AI DEBUG] steps probe failed ❌
```

## 🚨 Emergency Debug

If everything is broken:

```tsx
// Add this to your component temporarily
useEffect(() => {
  console.log('[EMERGENCY DEBUG] Component state:', {
    moduleId,
    videoUrl,
    hasSteps: steps?.length > 0,
    timestamp: new Date().toISOString()
  })
}, [moduleId, videoUrl, steps])
```

## 🔄 Revert After Debug

Once you've identified the issue:

```tsx
// Remove debug components
// import { VideoDebugEvents } from '../components/VideoDebugEvents'
// import { useStepsProbe } from '../hooks/useStepsProbe'

// Restore your original video player
<video src={videoUrl} controls />
```

---

**Remember:** The debug components are **temporary**. Use them to identify the issue, then remove them and fix the root cause!
