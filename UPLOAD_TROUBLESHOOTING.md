# Video Upload Troubleshooting Guide

## Overview
This guide helps diagnose and fix issues with the video upload system in the adapt-v3 project.

## Common Issues and Solutions

### 1. "Missing required fields" Error

**Symptoms:**
- Error: `"Missing required fields: moduleId, originalFilename, totalChunks"`
- Upload fails during finalization step

**Causes:**
- FormData not properly constructed
- Network issues causing data loss
- CORS issues preventing proper request

**Solutions:**
1. **Check browser console** for detailed error messages
2. **Verify network connectivity** between frontend and backend
3. **Check CORS configuration** in backend
4. **Ensure all required fields are present** in the request

### 2. 404 Errors for Transcript Endpoints

**Symptoms:**
- `GET /api/transcript/{moduleId}` returns 404
- Transcript data not available after upload

**Solution:**
- ✅ **FIXED**: Added transcript routes to server.ts
- Restart the backend server to apply changes

### 3. Chunk Upload Failures

**Symptoms:**
- Individual chunks fail to upload
- Incomplete file reassembly

**Solutions:**
1. **Check chunk size** - default is 2MB, can be adjusted
2. **Verify temp directory permissions** - ensure backend can write to uploads/temp
3. **Check network stability** - large files may timeout
4. **Review server logs** for detailed error messages

### 4. File Size Issues

**Symptoms:**
- Upload fails for large files
- Memory issues during processing

**Solutions:**
1. **Adjust chunk size** in frontend configuration
2. **Increase server memory limits** in multer configuration
3. **Enable video compression** (already implemented)
4. **Check available disk space** for uploads directory

## Debugging Steps

### 1. Check Server Status
```bash
# Test server health
curl http://localhost:8000/api/health
```

### 2. Test Upload Endpoints
```bash
# Run the test script
node backend/test-upload.js
```

### 3. Check Logs
- **Frontend**: Open browser console (F12)
- **Backend**: Check terminal output for detailed logs

### 4. Verify File Structure
```
backend/
├── uploads/          # Final video files
├── uploads/temp/     # Temporary chunk storage
└── data/
    ├── modules.json  # Module metadata
    ├── training/     # Training data
    └── transcripts/  # Transcript files
```

## Configuration

### Frontend Configuration
```typescript
// frontend/src/utils/chunkedUpload.ts
const options = {
  chunkSize: 2 * 1024 * 1024, // 2MB chunks
  maxConcurrent: 3,            // Concurrent uploads
  retryAttempts: 3,            // Retry attempts
  retryDelay: 1000             // Delay between retries
}
```

### Backend Configuration
```typescript
// backend/src/routes/uploadRoutes.ts
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
})
```

## Recent Fixes Applied

### ✅ Fixed Issues:
1. **Missing transcript routes** - Added to server.ts
2. **Enhanced error handling** - Better validation and error messages
3. **Improved CORS configuration** - Added specific headers for upload routes
4. **Better debugging** - Enhanced logging throughout the upload process
5. **Chunk validation** - Added checks for missing chunks and invalid data

### 🔧 Improvements Made:
1. **Detailed error messages** - Now shows exactly which fields are missing
2. **Better validation** - Checks for numeric values and valid ranges
3. **Enhanced logging** - More detailed console output for debugging
4. **CORS headers** - Specific headers for upload routes
5. **File existence checks** - Validates temp directories and chunk files

## Testing the Fix

1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test upload:**
   - Navigate to http://localhost:5180/upload
   - Upload a video file
   - Check browser console and server logs for detailed information

4. **Verify results:**
   - Check that video appears in backend/uploads/
   - Verify module data is saved in backend/data/
   - Confirm transcript is generated in backend/data/transcripts/

## Support

If issues persist:
1. Check the browser console for detailed error messages
2. Review server logs for backend errors
3. Verify all environment variables are set correctly
4. Ensure sufficient disk space and memory
5. Test with smaller files first to isolate issues 