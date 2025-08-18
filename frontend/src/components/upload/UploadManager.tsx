import React, { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithProgress, validateFile } from '@utils/uploadUtils'
import { API_ENDPOINTS } from '../../config/api'
import { useModuleProcessing } from '../../hooks/useModuleProcessing'

export const UploadManager: React.FC = () => {
  const { uploads, addUpload, updateProgress, markSuccess, markError, startUpload } = useUploadStore()
  
  const [showProcessing, setShowProcessing] = useState(false)
  const [justUploadedModuleId, setJustUploadedModuleId] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const { status, progress, error } = useModuleProcessing(justUploadedModuleId || undefined)
  
  // Auto-redirect when ready
  useEffect(() => {
    if (!showProcessing || !justUploadedModuleId) return
    if (status === "READY") {
      navigate(`/training/${justUploadedModuleId}`)
    }
  }, [status, showProcessing, justUploadedModuleId, navigate])
  
  // Optional toast or console when failed
  useEffect(() => {
    if (status === "FAILED" && error) {
      console.error("Processing failed:", error)
    }
  }, [status, error])

  // Check if any uploads are in progress
  const hasActiveUploads = Object.values(uploads).some(upload => upload.status === 'uploading')
  const hasQueuedUploads = Object.values(uploads).some(upload => upload.status === 'queued')
  const isUploading = hasActiveUploads || hasQueuedUploads

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
          
          // Start the upload status
          startUpload(uploadId)
          
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
            
            // Show processing panel and start monitoring
            setJustUploadedModuleId(result.moduleId)
            setShowProcessing(true)
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
  }, [addUpload, updateProgress, markSuccess, markError, startUpload])

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
      {/* Processing Panel */}
      {showProcessing && justUploadedModuleId && (
        <div className="mt-4 mb-6 rounded-xl border p-4 bg-white/70">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-gray-300 border-t-transparent" />
            <div className="font-medium">
              {status === "FAILED" ? "Processing failed" : "Processing your video…"}
            </div>
          </div>

          {status !== "FAILED" && (
            <div className="mt-3">
              <div className="text-sm text-gray-500 mb-1">
                Module ID: {justUploadedModuleId}
              </div>
              <div className="h-2 w-full bg-gray-200 rounded">
                <div
                  className="h-2 bg-indigo-500 rounded transition-all"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{Math.round(progress ?? 0)}%</div>
              <div className="text-xs text-gray-500 mt-2">
                You'll be taken to the training automatically when it's ready.
              </div>
            </div>
          )}

          {status === "FAILED" && (
            <div className="mt-3 flex gap-8 items-center">
              <div className="text-sm text-red-600">{error || "Processing failed."}</div>
              <button
                className="px-3 py-1 rounded bg-indigo-600 text-white"
                onClick={() => {
                  // Let users jump straight to Training (where they can click "Re-run AI Step Detection")
                  navigate(`/training/${justUploadedModuleId}`)
                }}
              >
                Open Training
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Debug Info:</strong> Upload will go to {API_ENDPOINTS.UPLOAD}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isUploading 
            ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50'
            : isDragActive
            ? 'border-blue-500 bg-blue-50 cursor-pointer'
            : 'border-gray-300 hover:border-gray-400 cursor-pointer'
        }`}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <div className="space-y-2">
          <div className="text-2xl">
            {isUploading ? '⏳' : '📹'}
          </div>
          <p className="text-lg font-medium text-gray-900">
            {isUploading 
              ? 'Upload in progress...' 
              : isDragActive 
              ? 'Drop the video here' 
              : 'Drag & drop video here'
            }
          </p>
          <p className="text-sm text-gray-500">
            {isUploading 
              ? 'Please wait for current uploads to complete'
              : 'or click to select a file (MP4, WebM, AVI, MOV, max 200MB)'
            }
          </p>
        </div>
      </div>

      {/* Upload Queue */}
      {Object.keys(uploads).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Upload Queue</h3>
          
          {/* Upload Status Summary */}
          {isUploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-blue-800">
                  {hasActiveUploads ? 'Uploading...' : 'Preparing upload...'}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {hasActiveUploads 
                  ? 'Your video is being uploaded to our servers'
                  : 'Getting ready to upload your video'
                }
              </p>
            </div>
          )}
          
          {Object.entries(uploads).map(([id, upload]) => (
            <UploadItem key={id} id={id} upload={upload} />
          ))}
        </div>
      )}
    </div>
  )
}
