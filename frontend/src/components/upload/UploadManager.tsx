import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithProgress, validateFile } from '@utils/uploadUtils'
import { uploadWithPresignedUrl } from '@utils/presignedUpload'

export const UploadManager: React.FC = () => {
  const navigate = useNavigate()
  const { uploads, addUpload, updateProgress, markSuccess, markError } = useUploadStore()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        // Validate file
        const validation = await validateFile(file)
        if (!validation.valid) {
          throw new Error(validation.error)
        }

        // Add to upload queue
        const uploadId = addUpload(file)

        // Start upload using presigned URL flow (intended flow)
        try {
          console.log('🚀 Starting presigned upload flow for:', file.name)
          
          const result = await uploadWithPresignedUrl({
            file,
            onProgress: (progress) => updateProgress(uploadId, progress),
            // signal: abortController.signal // TODO: Add abort support
          })

          console.log('✅ Upload completed:', result)
          markSuccess(uploadId, result.moduleId)

          // Navigate to the training page after successful upload
          console.log('📍 Navigating to training page:', result.moduleId)

          // Small delay to show success state, then navigate
          setTimeout(() => {
            navigate(`/training/${result.moduleId}`)
          }, 1500)

        } catch (error) {
          console.error('❌ Presigned upload error:', error)
          markError(uploadId, error as Error)
        }
      } catch (error) {
        console.error('File validation error:', error)
        // For validation errors, we need to show them to the user
        // We can create a temporary upload entry just to show the error
        const tempId = addUpload(file)
        markError(tempId, error as Error)
      }
    }
  }, [addUpload, updateProgress, markSuccess, markError, navigate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false, // Only allow one file at a time for better UX
  })

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
          <p className="text-sm text-gray-500">
            or click to select a file
          </p>
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
            .sort(([, a], [, b]) => b.timestamp - a.timestamp) // Show newest first
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