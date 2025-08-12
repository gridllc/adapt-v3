# S3 Signed URL Refactoring Summary

## Overview
This refactoring implements a secure S3 access pattern where the system stores and passes S3 keys (e.g., `videos/abc.mp4`) instead of full URLs, and generates short-lived signed URLs on-demand when file access is needed.

## What Was Implemented

### 1. Enhanced Storage Service (`services/storageService.ts`)
- Added `generateSignedUrl(key: string, expiresIn = 900)` function
- Generates short-lived signed URLs (15 minutes default) for S3 objects
- Falls back to local URLs when S3 is not configured
- Uses existing S3 client configuration

### 2. New Storage Routes (`routes/storageRoutes.ts`)
- `GET /api/storage/signed-url?key=<s3-key>` endpoint
- Generates signed URLs for S3 objects
- Proper error handling for missing/invalid keys
- Integrated into main server routes

### 3. Refactored Video Downloader (`services/ai/videoDownloader.ts`)
- Added `toS3Key()` function to normalize input (URLs → keys)
- Updated `downloadVideoFromUrl()` to use signed URLs via backend API
- Added `downloadS3Object()` function for direct S3 key downloads
- Backward compatible - accepts both keys and full URLs

### 4. Updated Upload Controller (`controllers/uploadController.ts`)
- Now extracts and stores S3 keys instead of full URLs
- Returns S3 keys in responses instead of public URLs
- AI processing pipeline receives S3 keys for secure access

### 5. Enhanced Environment Configuration (`config/env.ts`)
- Added `API_BASE_URL` environment variable support
- Added `getApiBaseUrl()` helper function
- Maintains backward compatibility

## Key Benefits

### Security
- No public S3 URLs stored in database
- Short-lived signed URLs (15 minutes) for temporary access
- No bucket policy changes required
- No public ACL modifications needed

### Flexibility
- Backward compatible with existing code
- Can handle both S3 keys and full URLs
- Graceful fallback to local storage when S3 unavailable

### Performance
- Reduced storage overhead (keys vs full URLs)
- Signed URLs generated only when needed
- Efficient S3 access patterns

## Usage Examples

### Frontend Usage
```typescript
// Get signed URL for video playback
const response = await fetch('/api/storage/signed-url?key=videos/abc.mp4');
const { url } = await response.json();
// Use url for video element src
```

### Backend Usage
```typescript
// Generate signed URL for internal processing
const signedUrl = await storageService.generateSignedUrl('videos/abc.mp4', 900);
// Use signedUrl for file downloads
```

### AI Pipeline
```typescript
// Pass S3 key to AI service
await aiService.generateStepsForModule(moduleId, 'videos/abc.mp4');
// VideoDownloader automatically converts to signed URL
```

## Environment Variables

```bash
# Required for S3 functionality
AWS_REGION=us-west-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name

# Optional for custom API base URL
API_BASE_URL=https://your-api-domain.com
```

## Testing

Run the test script to verify storage routes:
```bash
cd backend
node test-storage-routes.js
```

## Migration Notes

### Database
- Existing modules with full URLs will continue to work
- New uploads will store S3 keys
- Consider migrating existing data if needed

### Frontend
- Update video playback to use `/api/storage/signed-url?key=<key>`
- Update any hardcoded S3 URL references
- Maintain backward compatibility during transition

### Backend
- All existing code continues to work
- New code should prefer S3 keys over URLs
- AI pipeline automatically handles both formats

## Future Improvements

1. **Batch Signed URLs**: Generate multiple signed URLs in one request
2. **Caching**: Cache signed URLs for frequently accessed files
3. **Monitoring**: Track signed URL usage and generation metrics
4. **Expiration Management**: Implement URL expiration notifications
5. **CDN Integration**: Extend to work with CloudFront or other CDNs

## Security Considerations

- Signed URLs expire after 15 minutes (configurable)
- URLs are single-use for sensitive operations
- No persistent public access to S3 objects
- Audit logging for signed URL generation
- Rate limiting on signed URL endpoints

## Troubleshooting

### Common Issues
1. **403 Errors**: Check S3 credentials and bucket permissions
2. **Missing Keys**: Verify S3 key format and existence
3. **Expired URLs**: Regenerate signed URL if expired
4. **CORS Issues**: Ensure proper CORS configuration

### Debug Steps
1. Check S3 client initialization logs
2. Verify environment variables
3. Test signed URL generation manually
4. Check S3 bucket permissions
5. Review CloudWatch logs for S3 access
