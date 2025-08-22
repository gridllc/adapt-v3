import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { validateFile } from '@utils/uploadUtils'
import { uploadWithPresignedUrl } from '@utils/presignedUpload'
import { useAuth } from '@clerk/clerk-react'

export const UploadManager: React.FC = () => {
  const navigate = useNavigate()
  const { uploads, addUpload, updateProgress, markSuccess, markError } = useUploadStore()
  const { isSignedIn, isLoaded } = useAuth()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Check authentication first
      if (!isLoaded) {
        console.warn('⚠️ Auth not loaded yet, waiting...');
        return;
      }
      
      if (!isSignedIn) {
        console.error('❌ User not authenticated, cannot upload');
        markError('auth-required', new Error('Please sign in to upload videos'));
        return;
      }

      for (const file of acceptedFiles) {
        try {
          // Validate file
          const validation = await validateFile(file)
          if (!validation.valid) {
            throw new Error(validation.error)
          }

          // Add to upload queue
          const uploadId = addUpload(file)

          // Upload with presigned URL flow
          const result = await uploadWithPresignedUrl({
            file,
            onProgress: (progress) => updateProgress(uploadId, progress),
          })

          if (result.success && result.moduleId) {
            markSuccess(uploadId, result.moduleId)

            // Navigate to training page after small delay
            setTimeout(() => {
              navigate(`/training/${result.moduleId}`)
            }, 1200)
          } else {
            console.error('❌ Upload failed:', result.error)
            markError(uploadId, new Error(result.error || 'Upload failed'))
          }
        } catch (err: any) {
          console.error('❌ File validation error:', err)
          const tempId = addUpload(file)
          markError(tempId, err)
        }
      }
    },
    [addUpload, updateProgress, markSuccess, markError, navigate]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false, // one file at a time
  })

  // Show loading state while auth is loading
  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <div className="text-4xl">⏳</div>
          <h3 className="text-lg font-medium text-gray-900">Loading...</h3>
          <p className="text-sm text-gray-500">Please wait while we check your authentication</p>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center bg-yellow-50 border-yellow-300">
          <div className="text-4xl">🔐</div>
          <h3 className="text-lg font-medium text-gray-900">Authentication Required</h3>
          <p className="text-sm text-gray-500">Please sign in to upload training videos</p>
          <button 
            onClick={() => navigate('/sign-in')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="text-4xl">📹</div>
          <h3 className="text-lg font-medium text-gray-900">
            {isDragActive ? 'Drop the video here' : 'Drag & drop your training video'}
          </h3>
          <p className="text-sm text-gray-500">or click to select a file</p>
          <div className="text-xs text-gray-400 space-y-1">
            <p>• Supported formats: MP4, WebM</p>
            <p>• Maximum duration: 3 minutes</p>
            <p>• Maximum file size: 100MB</p>
          </div>
        </div>
      </div>

      {/* Upload Queue */}
      {Object.keys(uploads).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Upload Status</h3>
          {Object.entries(uploads)
            .sort(([, a], [, b]) => b.timestamp - a.timestamp)
            .map(([id, upload]) => (
              <UploadItem key={id} id={id} upload={upload} />
            ))}
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Upload your training video (MP4 or WebM, 3 minutes max)</li>
          <li>Our AI will automatically analyze the video and extract steps</li>
          <li>You'll be redirected to the interactive training interface</li>
          <li>Use the AI assistant to get help with each step</li>
        </ol>
      </div>
    </div>
  )
}
