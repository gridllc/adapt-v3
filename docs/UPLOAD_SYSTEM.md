# Upload System Documentation

## Overview

The Adapt application uses a **presigned URL upload system** for reliable, scalable video file uploads. This system replaces the previous multipart upload implementation and provides better performance, reliability, and user experience.

## Architecture

### Backend Components

#### 1. **Presigned Upload Service** (`presignedUploadService.ts`)
- **Location**: `backend/src/services/presignedUploadService.ts`
- **Purpose**: Generates presigned URLs for direct S3 uploads and confirms upload completion
- **Key Methods**:
  - `generatePresignedUrl(filename, contentType)`: Creates presigned URL for S3 upload
  - `confirmUpload(key)`: Verifies file exists in S3 after upload
  - `getPublicUrl(key)`: Returns public S3 URL for uploaded files

#### 2. **Upload Controller** (`uploadController.ts`)
- **Location**: `backend/src/controllers/uploadController.ts`
- **Endpoints**:
  - `POST /api/upload/presigned-url`: Generate presigned URL
  - `POST /api/upload/process`: Process uploaded video with AI
  - `POST /api/upload`: Legacy endpoint for backward compatibility

#### 3. **Upload Routes** (`uploadRoutes.ts`)
- **Location**: `backend/src/routes/uploadRoutes.ts`
- **Features**:
  - File validation (video types only)
  - 200MB file size limit
  - Progress tracking support

### Frontend Components

#### 1. **Presigned Upload Utility** (`presignedUpload.ts`)
- **Location**: `frontend/src/utils/presignedUpload.ts`
- **Features**:
  - Direct S3 upload with progress tracking
  - File validation (MP4, WebM, AVI, MOV, WMV, FLV)
  - 200MB file size limit
  - Error handling and retry logic

#### 2. **Upload Manager** (`UploadManager.tsx`)
- **Location**: `frontend/src/components/upload/UploadManager.tsx`
- **Features**:
  - Drag & drop file upload
  - Progress tracking
  - Multiple file support
  - Authentication integration

#### 3. **Upload Store** (`uploadStore.ts`)
- **Location**: `frontend/src/stores/uploadStore.ts`
- **State Management**:
  - Upload queue management
  - Progress tracking
  - Error handling
  - Success/failure states

## Upload Flow

### 1. **File Selection & Validation**
```typescript
// Frontend validates file before upload
const validation = validateFileForUpload(file)
if (!validation.valid) {
  console.warn(`File validation failed: ${validation.error}`)
  return
}
```

**Validation Rules**:
- **File Types**: MP4, WebM, AVI, MOV, WMV, FLV
- **File Size**: Maximum 200MB
- **Content**: Video files only

### 2. **Presigned URL Generation**
```typescript
// Backend generates presigned URL
const result = await presignedUploadService.generatePresignedUrl(
  filename, 
  contentType
)
```

**Response**:
```json
{
  "success": true,
  "presignedUrl": "https://...",
  "key": "videos/1234567890-uuid-filename.mp4",
  "fileUrl": "https://bucket.s3.region.amazonaws.com/videos/..."
}
```

### 3. **Direct S3 Upload**
```typescript
// Frontend uploads directly to S3
await uploadToS3({
  file,
  presignedUrl,
  onProgress: (progress) => updateProgress(uploadId, progress),
  signal: abortController.signal,
})
```

**Features**:
- Progress tracking
- Abort support
- Error handling
- Automatic retry logic

### 4. **Upload Confirmation**
```typescript
// Backend confirms file exists in S3
const uploadConfirmation = await presignedUploadService.confirmUpload(key)
if (!uploadConfirmation.success) {
  throw new Error('Video file not found')
}
```

### 5. **AI Processing**
```typescript
// Process video with AI service
const moduleData = await aiService.processVideo(videoUrl)
const moduleId = await storageService.saveModule(moduleData)
```

## Configuration

### Environment Variables

```bash
# AWS S3 Configuration
AWS_BUCKET_NAME=your-bucket-name
AWS_REGION=us-west-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Upload Limits
MAX_FILE_SIZE=209715200  # 200MB in bytes
ALLOWED_VIDEO_TYPES=video/mp4,video/mov,video/webm,video/avi,video/wmv,video/flv
UPLOAD_TIMEOUT=300000    # 5 minutes in ms
```

### File Size Limits

- **Maximum File Size**: 200MB
- **Recommended**: Under 100MB for optimal performance
- **Supported Formats**: MP4, WebM, AVI, MOV, WMV, FLV

## Error Handling

### Common Error Scenarios

1. **File Too Large**
   ```json
   {
     "success": false,
     "error": "File size exceeds maximum allowed size of 200MB"
   }
   ```

2. **Invalid File Type**
   ```json
   {
     "success": false,
     "error": "Only video files are allowed"
   }
   ```

3. **Upload Failure**
   ```json
   {
     "success": false,
     "error": "Video file not found. Please ensure upload completed successfully."
   }
   ```

### Retry Logic

- **Automatic Retries**: 3 attempts with exponential backoff
- **User Retry**: Manual retry button for failed uploads
- **Progress Persistence**: Upload progress maintained across retries

## Security Features

### Authentication
- **Required**: All upload endpoints require valid authentication
- **Token Validation**: JWT tokens validated on each request
- **User Limits**: Configurable upload limits per user

### File Validation
- **Server-side**: Content type and size validation
- **Client-side**: Pre-upload validation for better UX
- **S3 Security**: Bucket policies and CORS configuration

## Performance Optimizations

### Upload Efficiency
- **Direct S3**: Bypasses application server for file transfer
- **Progress Tracking**: Real-time upload progress updates
- **Parallel Processing**: Multiple files can upload simultaneously

### Processing Pipeline
- **Async Processing**: Video processing happens after upload completion
- **Queue Management**: Uploads are queued and processed efficiently
- **Resource Management**: Configurable concurrent upload limits

## Monitoring & Debugging

### Health Checks
```bash
GET /api/upload/health
```

**Response**:
```json
{
  "success": true,
  "service": "upload-service",
  "status": "healthy",
  "features": {
    "presignedUpload": true,
    "legacyUpload": true,
    "maxFileSize": "200MB",
    "allowedTypes": ["video/mp4", "video/mov", "video/webm"]
  }
}
```

### Logging
- **Upload Events**: All upload activities are logged
- **Error Tracking**: Detailed error logs with stack traces
- **Performance Metrics**: Upload times and success rates

## Migration from Multipart System

### What Changed
- ❌ **Removed**: Multipart upload endpoints and services
- ❌ **Removed**: Part-based progress tracking
- ❌ **Removed**: Multipart-specific frontend components
- ✅ **Added**: Presigned URL upload system
- ✅ **Added**: Direct S3 upload with progress
- ✅ **Added**: Simplified upload flow

### Backward Compatibility
- **Legacy Endpoint**: `POST /api/upload` still available
- **File Processing**: Same AI processing pipeline
- **User Experience**: Improved upload reliability

## Troubleshooting

### Common Issues

1. **Upload Fails with 403**
   - Check AWS credentials and bucket permissions
   - Verify presigned URL hasn't expired

2. **Progress Not Updating**
   - Ensure `onProgress` callback is properly configured
   - Check browser console for errors

3. **File Processing Fails**
   - Verify file was uploaded to S3 successfully
   - Check AI service configuration and API keys

### Debug Steps

1. **Check Network Tab**: Verify presigned URL requests
2. **S3 Console**: Confirm files are uploaded to correct bucket
3. **Backend Logs**: Review server-side error messages
4. **Frontend Console**: Check for JavaScript errors

## Future Enhancements

### Planned Features
- **Resumable Uploads**: Resume interrupted uploads
- **Chunked Uploads**: Better handling of very large files
- **Upload Scheduling**: Background upload processing
- **Advanced Analytics**: Upload performance metrics

### Performance Improvements
- **CDN Integration**: Faster file delivery
- **Compression**: Automatic video compression
- **Caching**: Intelligent file caching strategies

---

## Support

For technical support or questions about the upload system:
- **Documentation**: Check this file for updates
- **Issues**: Report bugs through the project issue tracker
- **Questions**: Contact the development team

**Last Updated**: December 2024
**Version**: 2.0 (Presigned Upload System) 