# Enhanced Upload System Documentation

## Overview

The enhanced upload system provides a comprehensive solution for handling video uploads with advanced features like chunked uploads, resumable uploads, batch processing, upload queues, and video processing capabilities.

## Features

### 🎯 Core Features
- **Standard Upload**: Simple single-file upload with validation
- **Chunked Uploads**: For very large files (>100MB)
- **Resumable Uploads**: Allow users to resume interrupted uploads
- **Batch Uploads**: Upload multiple files simultaneously
- **Upload Queue**: Manage multiple uploads with priority
- **Video Processing**: Metadata extraction, thumbnail generation, compression

### 🛡️ Security Features
- **File Validation**: Size, type, and content validation
- **Rate Limiting**: Prevent abuse with configurable limits
- **Authentication**: All uploads require user authentication
- **Dangerous File Detection**: Block malicious file types

### ⚡ Performance Features
- **Progress Tracking**: Real-time upload progress
- **Configurable Limits**: Environment-based file size and type limits
- **CORS Support**: Optimized for cross-origin requests
- **Error Handling**: Comprehensive error responses with codes

## API Endpoints

### Standard Upload

#### `POST /api/upload`
Standard single-file upload with validation and processing.

**Request:**
```bash
curl -X POST /api/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@video.mp4"
```

**Response:**
```json
{
  "success": true,
  "moduleId": "uuid",
  "videoUrl": "https://s3.amazonaws.com/bucket/video.mp4",
  "title": "video",
  "redirectUrl": "/training/uuid",
  "message": "Video uploaded successfully",
  "fileInfo": {
    "name": "video.mp4",
    "size": 1048576,
    "type": "video/mp4"
  }
}
```

### Enhanced Upload Features

#### Chunked Uploads

**`POST /api/upload-enhanced/chunked`**
Upload large files in chunks.

**Request:**
```bash
curl -X POST /api/upload-enhanced/chunked \
  -H "Authorization: Bearer <token>" \
  -F "chunk=@chunk_data" \
  -F "chunkNumber=0" \
  -F "totalChunks=10" \
  -F "chunkSize=1048576" \
  -F "totalSize=10485760" \
  -F "fileId=uuid" \
  -F "fileName=large_video.mp4"
```

**Response:**
```json
{
  "success": true,
  "message": "Chunk 1/10 received",
  "chunkNumber": 0,
  "totalChunks": 10,
  "progress": "10% (1.0 MB / 10.0 MB)"
}
```

#### Resumable Uploads

**`POST /api/upload-enhanced/resumable/init`**
Initialize a resumable upload session.

**Request:**
```bash
curl -X POST /api/upload-enhanced/resumable/init \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "video.mp4",
    "totalSize": 10485760,
    "userId": "user_id"
  }'
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_uuid",
  "message": "Upload session created"
}
```

**`POST /api/upload-enhanced/resumable/chunk`**
Upload a chunk for resumable upload.

**Request:**
```bash
curl -X POST /api/upload-enhanced/resumable/chunk \
  -H "Authorization: Bearer <token>" \
  -F "chunk=@chunk_data" \
  -F "sessionId=session_uuid" \
  -F "chunkNumber=0"
```

**`GET /api/upload-enhanced/resumable/status/:sessionId`**
Get upload session status.

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "session_uuid",
    "fileName": "video.mp4",
    "uploadedSize": 5242880,
    "totalSize": 10485760,
    "progress": "50% (5.0 MB / 10.0 MB)",
    "chunks": [0, 1, 2, 3, 4],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActivity": "2024-01-01T00:05:00.000Z"
  }
}
```

#### Batch Uploads

**`POST /api/upload-enhanced/batch`**
Upload multiple files simultaneously.

**Request:**
```bash
curl -X POST /api/upload-enhanced/batch \
  -H "Authorization: Bearer <token>" \
  -F "files=@video1.mp4" \
  -F "files=@video2.mp4" \
  -F "files=@video3.mp4"
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch_uuid",
  "totalFiles": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    {
      "fileName": "video1.mp4",
      "success": true,
      "moduleId": "uuid1"
    },
    {
      "fileName": "video2.mp4",
      "success": true,
      "moduleId": "uuid2"
    },
    {
      "fileName": "video3.mp4",
      "success": false,
      "error": "File too large"
    }
  ],
  "message": "Batch upload completed: 2/3 successful"
}
```

#### Upload Queue

**`POST /api/upload-enhanced/queue`**
Add file to upload queue with priority.

**Request:**
```bash
curl -X POST /api/upload-enhanced/queue \
  -H "Authorization: Bearer <token>" \
  -F "file=@video.mp4" \
  -F "priority=high"
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_uuid",
  "message": "Upload job added to queue",
  "priority": "high"
}
```

**`GET /api/upload-enhanced/queue/status/:jobId`**
Get job status.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "job_uuid",
    "status": "processing",
    "progress": 75,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "startedAt": "2024-01-01T00:01:00.000Z",
    "completedAt": null,
    "error": null
  }
}
```

**`GET /api/upload-enhanced/queue/user/:userId`**
Get all jobs for a user.

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "job_uuid",
      "status": "completed",
      "progress": 100,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "startedAt": "2024-01-01T00:01:00.000Z",
      "completedAt": "2024-01-01T00:02:00.000Z",
      "error": null
    }
  ]
}
```

#### Video Processing

**`POST /api/upload-enhanced/process/metadata`**
Extract video metadata.

**Request:**
```bash
curl -X POST /api/upload-enhanced/process/metadata \
  -H "Authorization: Bearer <token>" \
  -F "file=@video.mp4"
```

**Response:**
```json
{
  "success": true,
  "metadata": {
    "duration": 120.5,
    "width": 1920,
    "height": 1080,
    "bitrate": 5000000,
    "codec": "h264",
    "fps": 30
  },
  "message": "Metadata extracted successfully"
}
```

**`POST /api/upload-enhanced/process/thumbnail`**
Generate video thumbnail.

**Request:**
```bash
curl -X POST /api/upload-enhanced/process/thumbnail \
  -H "Authorization: Bearer <token>" \
  -F "file=@video.mp4" \
  -F "timestamp=5"
```

**Response:** Binary image data

**`POST /api/upload-enhanced/process/compress`**
Compress video.

**Request:**
```bash
curl -X POST /api/upload-enhanced/process/compress \
  -H "Authorization: Bearer <token>" \
  -F "file=@video.mp4" \
  -F "quality=medium"
```

**Response:** Compressed video file

## Configuration

### Environment Variables

```bash
# Upload Configuration
MAX_FILE_SIZE=104857600                    # 100MB in bytes
ALLOWED_VIDEO_TYPES=video/mp4,video/mov,video/webm,video/avi,video/wmv,video/flv
UPLOAD_TIMEOUT=300000                     # 5 minutes in ms
ENABLE_FILE_COMPRESSION=true              # Enable automatic compression
```

### Rate Limiting

- **Window**: 15 minutes
- **Limit**: 10 uploads per user
- **Headers**: Standard rate limit headers included

### File Validation

- **Size**: Configurable via `MAX_FILE_SIZE`
- **Type**: Configurable via `ALLOWED_VIDEO_TYPES`
- **Extensions**: Blocks dangerous file types (.exe, .js, etc.)
- **Content**: Validates MIME types

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error title",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "type": "ERROR_TYPE"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `NO_FILE` | No file provided |
| `FILE_TOO_LARGE` | File exceeds size limit |
| `INVALID_TYPE` | File type not allowed |
| `DANGEROUS_EXTENSION` | Dangerous file type detected |
| `EMPTY_FILENAME` | File name is required |
| `RATE_LIMIT` | Too many uploads |
| `UNAUTHORIZED` | User not authenticated |
| `VALIDATION_ERROR` | File validation failed |
| `SERVER_ERROR` | Internal server error |

### Error Types

| Type | Description |
|------|-------------|
| `VALIDATION_ERROR` | Client-side validation error |
| `AUTH_ERROR` | Authentication/authorization error |
| `RATE_LIMIT` | Rate limiting error |
| `SERVER_ERROR` | Server-side error |

## Frontend Integration

### JavaScript Example

```javascript
// Standard upload
const uploadFile = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  })
  
  const result = await response.json()
  
  if (result.success) {
    console.log('Upload successful:', result.moduleId)
    window.location.href = result.redirectUrl
  } else {
    console.error('Upload failed:', result.error)
  }
}

// Chunked upload
const uploadChunked = async (file) => {
  const chunkSize = 1024 * 1024 // 1MB chunks
  const totalChunks = Math.ceil(file.size / chunkSize)
  const fileId = generateUUID()
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)
    
    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('chunkNumber', i)
    formData.append('totalChunks', totalChunks)
    formData.append('chunkSize', chunkSize)
    formData.append('totalSize', file.size)
    formData.append('fileId', fileId)
    formData.append('fileName', file.name)
    
    const response = await fetch('/api/upload-enhanced/chunked', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    const result = await response.json()
    console.log(`Chunk ${i + 1}/${totalChunks}:`, result.progress)
  }
}
```

## Production Considerations

### CDN Integration
- Configure CloudFront or similar CDN for faster file delivery
- Set up proper cache headers for video files
- Use signed URLs for secure access

### Virus Scanning
- Integrate with AWS GuardDuty or similar service
- Scan uploaded files before processing
- Quarantine suspicious files

### Compression
- Automatic video compression based on quality settings
- Configurable compression levels (low, medium, high)
- Balance between quality and file size

### Thumbnail Generation
- Generate thumbnails at specific timestamps
- Support multiple thumbnail sizes
- Cache thumbnails for performance

### Metadata Extraction
- Extract video duration, resolution, codec info
- Store metadata in database for quick access
- Use metadata for processing decisions

## Monitoring and Logging

### Key Metrics
- Upload success/failure rates
- File size distributions
- Processing times
- Error rates by type

### Logging
- All upload attempts logged
- Error details captured
- Performance metrics tracked
- User activity monitored

## Security Best Practices

1. **Authentication**: All uploads require valid user tokens
2. **Validation**: Comprehensive file validation on server
3. **Rate Limiting**: Prevent abuse with configurable limits
4. **File Scanning**: Scan for malware and dangerous content
5. **Access Control**: Proper S3 bucket permissions
6. **HTTPS**: All uploads over secure connections
7. **CORS**: Properly configured for your domains

## Troubleshooting

### Common Issues

1. **File too large**: Check `MAX_FILE_SIZE` configuration
2. **Invalid file type**: Verify `ALLOWED_VIDEO_TYPES`
3. **Rate limited**: Wait before uploading more files
4. **Authentication error**: Ensure valid user token
5. **CORS error**: Check CORS configuration

### Debug Endpoints

- `GET /api/upload/health` - Upload service health
- `GET /api/upload-enhanced/health` - Enhanced upload service health

## Future Enhancements

1. **Real-time Progress**: WebSocket-based progress updates
2. **Advanced Compression**: AI-powered video optimization
3. **Multi-part Upload**: S3 multipart upload integration
4. **Video Editing**: Basic video editing capabilities
5. **Analytics**: Detailed upload analytics dashboard 