# Frontend Video URL Migration Guide

## Overview
The backend has been refactored to use S3 keys instead of full URLs. This improves security and performance while maintaining backward compatibility.

## What Changed

### Before
- Backend returned full S3 URLs: `https://bucket.s3.region.amazonaws.com/videos/abc.mp4`
- Frontend used URLs directly in video elements
- URLs were publicly accessible (security concern)

### After
- Backend returns S3 keys: `videos/abc.mp4`
- Frontend fetches short-lived signed URLs when needed
- URLs expire after 15 minutes (secure by default)

## New Hook: `useVideoUrl`

We've created a new hook that automatically handles both S3 keys and full URLs:

```typescript
import { useVideoUrl } from '../hooks/useVideoUrl'

function VideoPlayer({ videoKeyOrUrl }: { videoKeyOrUrl: string }) {
  const { url, loading, error } = useVideoUrl(videoKeyOrUrl)
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!url) return <div>No video available</div>
  
  return (
    <video controls>
      <source src={url} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  )
}
```

## Migration Steps

### 1. Replace `useSignedVideoUrl` with `useVideoUrl`

```typescript
// OLD
import { useSignedVideoUrl } from '../hooks/useSignedVideoUrl'
const { url, loading, error } = useSignedVideoUrl(filename)

// NEW
import { useVideoUrl } from '../hooks/useVideoUrl'
const { url, loading, error } = useVideoUrl(videoKeyOrUrl)
```

### 2. Update Component Props

```typescript
// OLD
interface VideoPlayerProps {
  filename: string
}

// NEW
interface VideoPlayerProps {
  videoKeyOrUrl: string // Can be S3 key or full URL
}
```

### 3. Update API Calls

The backend now returns S3 keys instead of full URLs. Update your components accordingly:

```typescript
// OLD: Expecting full URL
const videoUrl = module.videoUrl // https://bucket.s3.region.amazonaws.com/videos/abc.mp4

// NEW: Getting S3 key
const videoKey = module.videoUrl // videos/abc.mp4
```

## Backward Compatibility

The new system is fully backward compatible:

- **S3 Keys**: `videos/abc.mp4` → Automatically converted to signed URL
- **Full URLs**: `https://example.com/video.mp4` → Used directly
- **Legacy Data**: Existing modules with full URLs continue to work

## Examples

### Basic Video Player
```typescript
function VideoPlayer({ videoKeyOrUrl }: { videoKeyOrUrl: string }) {
  const { url, loading, error } = useVideoUrl(videoKeyOrUrl)
  
  if (loading) return <div>Loading video...</div>
  if (error) return <div>Error loading video: {error}</div>
  
  return url ? (
    <video controls className="w-full">
      <source src={url} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  ) : null
}
```

### Module List with Videos
```typescript
function ModuleList({ modules }: { modules: Module[] }) {
  return (
    <div>
      {modules.map(module => (
        <div key={module.id}>
          <h3>{module.title}</h3>
          <VideoPlayer videoKeyOrUrl={module.videoUrl} />
        </div>
      ))}
    </div>
  )
}
```

### Direct Signed URL Fetch
```typescript
async function getSignedUrl(s3Key: string): Promise<string> {
  const response = await fetch(`/api/storage/signed-url?key=${encodeURIComponent(s3Key)}`)
  const data = await response.json()
  return data.url
}

// Usage
const signedUrl = await getSignedUrl('videos/abc.mp4')
```

## Benefits

### Security
- No public S3 URLs stored in database
- Short-lived signed URLs (15 minutes)
- No bucket policy changes required

### Performance
- Reduced storage overhead
- URLs generated only when needed
- Efficient S3 access patterns

### Flexibility
- Works with both S3 keys and full URLs
- Easy to switch between storage backends
- Future-proof for CDN integration

## Troubleshooting

### Common Issues

1. **403 Errors**: Check if S3 key exists and backend has proper permissions
2. **CORS Issues**: Ensure backend CORS allows your frontend domain
3. **URL Expiration**: Signed URLs expire after 15 minutes, regenerate if needed

### Debug Steps

1. Check browser console for API errors
2. Verify S3 key format (should start with `videos/`)
3. Test signed URL endpoint directly: `/api/storage/signed-url?key=videos/test.mp4`
4. Check backend logs for S3 access issues

## Testing

Test the new system with various inputs:

```typescript
// Test S3 key
<VideoPlayer videoKeyOrUrl="videos/test-video.mp4" />

// Test full URL (should work as before)
<VideoPlayer videoKeyOrUrl="https://example.com/video.mp4" />

// Test undefined (should handle gracefully)
<VideoPlayer videoKeyOrUrl={undefined} />
```

## Future Enhancements

- **Batch Signed URLs**: Generate multiple URLs in one request
- **Caching**: Cache frequently accessed signed URLs
- **CDN Integration**: Extend to work with CloudFront
- **Monitoring**: Track URL generation and usage metrics
