import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithProgress, validateFile } from '@utils/uploadUtils'

export const UploadManager: React.FC = () => {
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

        // Start upload
        try {
          const response = await uploadWithProgress({
            file,
            url: '/api/upload',
            onProgress: (progress) => updateProgress(uploadId, progress),
          })

          if (response.ok) {
            const result = await response.json()
            markSuccess(uploadId, result.moduleId)
          } else {
            throw new Error(`Upload failed: ${response.status}`)
          }
        } catch (error) {
          markError(uploadId, error as Error)
        }
      } catch (error) {
        console.error('File processing error:', error)
      }
    }
  }, [addUpload, updateProgress, markSuccess, markError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  })

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
            or click to select a file (MP4, WebM, max 3 minutes)
          </p>
        </div>
      </div>

      {/* Upload Queue */}
      {Object.keys(uploads).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Upload Queue</h3>
          {Object.entries(uploads).map(([id, upload]) => (
            <UploadItem key={id} id={id} upload={upload} />
          ))}
        </div>
      )}
    </div>
  )
} 