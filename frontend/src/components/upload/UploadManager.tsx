import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithProgress, validateFile } from '@utils/uploadUtils'
import { API_ENDPOINTS } from '../../config/api'

export const UploadManager: React.FC = () => {
  const { uploads, addUpload, updateProgress, markSuccess, markError } = useUploadStore()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('Files dropped:', acceptedFiles)
    
    for (const file of acceptedFiles) {
      try {
        console.log('Processing file:', file.name)
        
        // Validate file
        const validation = await validateFile(file)
        if (!validation.valid) {
          throw new Error(validation.error)
        }

        // Add to upload queue
        const uploadId = addUpload(file)
        console.log('Added to queue:', uploadId)

        // Start upload - USE DIRECT URL (bypasses proxy)
        try {
          console.log('Starting upload...')
          
          const response = await uploadWithProgress({
            file,
            url: API_ENDPOINTS.UPLOAD, // Use configured API endpoint
            onProgress: (progress) => {
              console.log(`Upload progress: ${progress}%`)
              updateProgress(uploadId, progress)
            },
          })

          console.log('Upload response status:', response.status)

          if (response.ok) {
            const result = await response.json()
            console.log('Upload success:', result)
            markSuccess(uploadId, result.moduleId)
          } else {
            const errorText = await response.text()
            console.error('Upload failed:', response.status, errorText)
            throw new Error(`Upload failed: ${response.status}`)
          }
        } catch (error) {
          console.error('Upload error:', error)
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
      'video/avi': ['.avi'],
      'video/quicktime': ['.mov'],
    },
    maxSize: 200 * 1024 * 1024, // 200MB
  })

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Debug Info:</strong> Upload will go to {API_ENDPOINTS.UPLOAD}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
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
            or click to select a file (MP4, WebM, AVI, MOV, max 200MB)
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
