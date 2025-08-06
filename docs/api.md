# 📚 API Documentation - Adapt v3

## 🔗 Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://adapt-v3-backend.onrender.com`

## 🔐 Authentication

All API endpoints require authentication via Clerk. Include the user token in the Authorization header:

```bash
Authorization: Bearer <clerk-token>
```

## 📋 Endpoints

### Health Check

#### `GET /api/health`
Returns the health status of the backend and connected services.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "production",
  "uptime": 12345,
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Module Management

#### `GET /api/modules`
Retrieves all training modules for the authenticated user.

**Response:**
```json
{
  "success": true,
  "modules": [
    {
      "id": "module-123",
      "title": "How to Make Coffee",
      "description": "Learn the art of brewing perfect coffee",
      "videoUrl": "https://s3.amazonaws.com/bucket/video.mp4",
      "status": "complete",
      "progress": 100,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### `GET /api/modules/:id`
Retrieves a specific training module.

**Response:**
```json
{
  "success": true,
  "module": {
    "id": "module-123",
    "title": "How to Make Coffee",
    "description": "Learn the art of brewing perfect coffee",
    "videoUrl": "https://s3.amazonaws.com/bucket/video.mp4",
    "status": "complete",
    "progress": 100,
    "steps": [...],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Step Management

#### `GET /api/steps/:moduleId`
Retrieves all steps for a specific module.

**Response:**
```json
{
  "success": true,
  "steps": [
    {
      "id": "step-1",
      "moduleId": "module-123",
      "title": "Grind the beans",
      "description": "Use a burr grinder to grind fresh coffee beans",
      "timestamp": 30,
      "duration": 15,
      "order": 1
    }
  ]
}
```

#### `PUT /api/steps/:stepId`
Updates a specific step.

**Request Body:**
```json
{
  "title": "Updated step title",
  "description": "Updated step description",
  "timestamp": 45,
  "duration": 20
}
```

### File Upload

#### `POST /api/upload`
Uploads a video file for processing.

**Request:**
```bash
Content-Type: multipart/form-data
Body: video file
```

**Response:**
```json
{
  "success": true,
  "moduleId": "module-123",
  "videoUrl": "https://s3.amazonaws.com/bucket/video.mp4",
  "message": "Video uploaded successfully. Processing will begin shortly."
}
```

### AI Services

#### `POST /api/ai/chat`
Sends a message to the AI tutor.

**Request Body:**
```json
{
  "message": "How do I grind coffee beans?",
  "moduleId": "module-123",
  "stepId": "step-1",
  "context": {
    "currentStep": 1,
    "totalSteps": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "To grind coffee beans, you'll want to use a burr grinder for the most consistent results. Set it to a medium-fine grind for most brewing methods.",
  "confidence": 0.95
}
```

#### `POST /api/ai/rewrite-step`
Rewrites a step description using AI.

**Request Body:**
```json
{
  "stepId": "step-1",
  "prompt": "Make this step more detailed"
}
```

**Response:**
```json
{
  "success": true,
  "originalText": "Grind the beans",
  "rewrittenText": "Grind the coffee beans to a medium-fine consistency using a burr grinder for optimal extraction",
  "confidence": 0.92
}
```

### Feedback System

#### `POST /api/feedback/submit`
Submits user feedback.

**Request Body:**
```json
{
  "moduleId": "module-123",
  "rating": 5,
  "comment": "Great tutorial! Very helpful.",
  "category": "positive"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

#### `GET /api/feedback/stats`
Retrieves feedback statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 150,
    "positive": 120,
    "negative": 30,
    "averageRating": 4.2
  },
  "recentFeedback": [
    {
      "id": "feedback-1",
      "rating": 5,
      "comment": "Excellent tutorial",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Worker Endpoints

#### `POST /api/worker/process-video`
Internal endpoint for processing uploaded videos (called by QStash).

**Request Body:**
```json
{
  "moduleId": "module-123",
  "videoUrl": "https://s3.amazonaws.com/bucket/video.mp4"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video processing completed"
}
```

#### `GET /api/worker/health`
Health check for the worker service.

**Response:**
```json
{
  "status": "ok",
  "service": "qstash-worker",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Debug Endpoints (Development Only)

#### `GET /api/debug/env`
Lists all environment variable keys (development only).

**Response:**
```json
[
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY"
]
```

## 🔄 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## 📊 Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Common error codes:
- `AUTH_REQUIRED` - Authentication required
- `INVALID_INPUT` - Invalid request data
- `NOT_FOUND` - Resource not found
- `PROCESSING_ERROR` - Video processing failed
- `AI_ERROR` - AI service error

## 🔒 Rate Limiting

- **General endpoints**: 100 requests/minute
- **Upload endpoints**: 10 requests/minute
- **AI endpoints**: 50 requests/minute

## 📈 Pagination

For endpoints that return lists, pagination is supported:

```bash
GET /api/modules?page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

## 🔍 Filtering & Sorting

### Modules
```bash
GET /api/modules?status=complete&sort=createdAt&order=desc
```

### Steps
```bash
GET /api/steps/:moduleId?order=asc
```

## 📝 Webhooks

### Clerk Webhooks
The backend receives webhooks from Clerk for user events:

```bash
POST /api/webhooks/clerk
```

**Events handled:**
- `user.created`
- `user.updated`
- `user.deleted`

## 🧪 Testing

### Health Check
```bash
curl https://adapt-v3-backend.onrender.com/api/health
```

### Test Upload
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@test-video.mp4" \
  https://adapt-v3-backend.onrender.com/api/upload
```

### Test AI Chat
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","moduleId":"test"}' \
  https://adapt-v3-backend.onrender.com/api/ai/chat
``` 