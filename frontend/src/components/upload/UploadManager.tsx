import React, { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { ProcessingBanner } from './ProcessingBanner'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithProgress, validateFile } from '@utils/uploadUtils'
import { API_ENDPOINTS } from '../../config/api'
import { DEBUG_UI } from '../../config/api'
import { useModuleStatus } from '../../hooks/useModuleStatus'

export const UploadManager: React.FC = () => {
  const { 
    uploads, 
    addUpload, 
    updateProgress, 
    markSuccess, 
    markError, 
    startUpload,
    setPhase,
    setModuleId,
    markProcessing,
    markReady
  } = useUploadStore()
  
  const navigate = useNavigate()

  // Check if any uploads are in progress
  const hasActiveUploads = Object.values(uploads).some(upload => upload.status === 'uploading')
  const hasQueuedUploads = Object.values(uploads).some(upload => upload.status === 'queued')
  const isUploading = hasActiveUploads || hasQueuedUploads

  // Get current upload for status display
  const currentUpload = Object.values(uploads).find(u => 
    ['uploading', 'success', 'error'].includes(u.status)
  )

  const showStatus = currentUpload && 
    ['uploading', 'finalizing', 'processing', 'ready', 'error'].includes(currentUpload.phase)

  // Use module status hook for processing uploads
  const processingUpload = Object.values(uploads).find(u => u.phase === 'processing')
  const { status: moduleStatus } = useModuleStatus(
    processingUpload?.moduleId || '', 
    !!processingUpload?.moduleId
  )

  // Update upload status when module processing completes
  useEffect(() => {
    if (processingUpload && moduleStatus && processingUpload.moduleId) {
      if (moduleStatus.status === 'ready') {
        markReady(processingUpload.id)
        // Navigate to training page
        navigate(`/training/${processingUpload.moduleId}`)
      } else if (moduleStatus.status === 'error') {
        markError(processingUpload.id, new Error('Processing failed'))
      }
    }
  }, [processingUpload, moduleStatus, markReady, markError, navigate])

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
          
          // Optional small nudge to show the phase is moving
          setTimeout(() => setPhase(uploadId, 'finalizing'), 300)
          
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
            
            // Set moduleId and switch to processing immediately
            setModuleId(uploadId, result.moduleId)
            markProcessing(uploadId)
            
            // Don't navigate immediately - let the status polling handle it
            // navigate(`/training/${result.moduleId}?processing=true`)
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
  }, [addUpload, updateProgress, markSuccess, markError, startUpload, setPhase, setModuleId, markProcessing, navigate])

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
      {/* Processing Banner - shows upload and processing status */}
      {showStatus && currentUpload && (
        <ProcessingBanner
          phase={currentUpload.phase}
          progress={currentUpload.progress}
          moduleId={currentUpload.moduleId}
        />
      )}

      {/* Debug Banner - only shown in development */}
      {DEBUG_UI && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Debug Info:</strong> Upload will go to {API_ENDPOINTS.UPLOAD}
          </p>
        </div>
      )}

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
