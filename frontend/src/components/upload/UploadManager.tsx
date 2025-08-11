import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { validateFileForUpload, uploadFileWithProgress } from '@utils/uploadFileWithProgress'

export const UploadManager: React.FC = () => {
  const { uploads, addUpload, updateProgress, markSuccess, markError } = useUploadStore()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        const validation = validateFileForUpload(file)
        if (!validation.isValid) {
          throw new Error(validation.error)
        }

        const uploadId = addUpload(file)

        try {
          // ✅ USE WORKING UPLOAD SYSTEM - NO MORE MISSING FILES
          const result = await uploadFileWithProgress(
            file,
            (progress) => updateProgress(uploadId, progress),
            {
              url: '/api/upload',
              onProgress: (progress) => updateProgress(uploadId, progress),
            }
          )

          markSuccess(uploadId, result.moduleId)
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
      'video/mov': ['.mov'],
    },
    maxSize: 200 * 1024 * 1024,
  })

  return (
    <div className="space-y-4">
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
            or click to select a file (MP4, WebM, AVI, MOV, max 200MB)
          </p>
        </div>
      </div>

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
