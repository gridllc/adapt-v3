import React, { useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithPresignedUrl } from '@utils/presignedUpload'
import { validateFileForUpload } from '@utils/uploadFileWithProgress'
import { useAuthToken } from '@hooks/useAuthToken'
import { Upload, Cloud, AlertCircle } from 'lucide-react'

export const UploadManager: React.FC = () => {
  const { 
    uploads, 
    addUpload, 
    updateProgress, 
    markSuccess, 
    markError 
  } = useUploadStore()

  const { getAuthToken, isSignedIn } = useAuthToken()
  const activeUploadsRef = useRef<Map<string, AbortController>>(new Map())

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        // Validate file
        const validation = validateFileForUpload(file)
        if (!validation.isValid) {
          console.warn(`File validation failed: ${validation.error}`)
          continue
        }

        // Check authentication
        if (!isSignedIn) {
          console.warn('User not signed in, skipping upload')
          continue
        }

        // Add to upload queue
        const uploadId = addUpload(file)
        console.log(`Added upload: ${uploadId} for file: ${file.name}`)

        // Create abort controller for this upload
        const abortController = new AbortController()
        activeUploadsRef.current.set(uploadId, abortController)

        try {
          // Get auth token
          const authToken = await getAuthToken()
          if (!authToken) {
            markError(uploadId, new Error('Failed to get authentication token'))
            continue
          }

          // Use presigned URL upload
          const result = await uploadWithPresignedUrl({
            file,
            onProgress: (progress) => updateProgress(uploadId, progress),
            signal: abortController.signal,
          })

          markSuccess(uploadId, result.moduleId)
          console.log(`Upload successful: ${uploadId} -> ${result.moduleId}`)
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            // Handle cancellation
            console.log(`Upload cancelled: ${uploadId}`)
            return
          }
          markError(uploadId, error as Error)
          console.error(`Upload failed: ${uploadId}`, error)
        } finally {
          // Clean up abort controller
          activeUploadsRef.current.delete(uploadId)
        }
      } catch (error) {
        console.error('File processing error:', error)
      }
    }
  }, [addUpload, updateProgress, markSuccess, markError, isSignedIn, getAuthToken])

  const cancelUpload = useCallback((uploadId: string) => {
    const abortController = activeUploadsRef.current.get(uploadId)
    if (abortController) {
      abortController.abort()
      activeUploadsRef.current.delete(uploadId)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
    maxSize: 200 * 1024 * 1024, // 200MB
    disabled: !isSignedIn
  })

  if (!isSignedIn) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <div className="space-y-2">
          <div className="text-2xl">🔒</div>
          <p className="text-lg font-medium text-gray-900">Sign in to upload videos</p>
          <p className="text-sm text-gray-500">
            Please sign in to access the upload functionality
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="text-2xl">📹</div>
          <p className="text-lg font-medium text-gray-900">
            {isDragActive ? 'Drop the video here' : 'Drag & drop video here'}
          </p>
          <p className="text-sm text-gray-500">
            or click to select a file (MP4, WebM, AVI, MOV, WMV, FLV, max 200MB)
          </p>
          <div className="text-xs text-gray-400 mt-2">
            <p>✨ Direct S3 upload • 🚀 No server processing • 📊 Real-time progress</p>
          </div>
        </div>
      </div>

      {/* Upload Queue */}
      {Object.keys(uploads).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Upload Queue</h3>
          {Object.entries(uploads).map(([id, upload]) => (
            <UploadItem 
              key={id} 
              id={id} 
              upload={upload}
              onCancel={() => cancelUpload(id)}
            />
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Cloud className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">New Upload System</p>
            <p className="mt-1">
              Videos are now uploaded directly to AWS S3 using presigned URLs. 
              This provides faster uploads, better reliability, and eliminates server timeout issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
