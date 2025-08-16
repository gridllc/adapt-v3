import React, { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { ProcessingBanner } from './ProcessingBanner'
import { useUploadStore } from '@stores/uploadStore'
import { uploadWithProgress, validateFile } from '@utils/uploadUtils'
import { API_ENDPOINTS } from '../../config/api'
import { useModuleStatus } from '../../hooks/useModuleStatus'
import { primeMicOnce } from '@/lib/micPrime'

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

  // Convert Map to array for easier processing
  const uploadsArray = Array.from(uploads.values())
  
  // Check if any uploads are in progress
  const hasActiveUploads = uploadsArray.some(upload => upload.status === 'uploading')
  const hasQueuedUploads = uploadsArray.some(upload => upload.status === 'queued')
  const isUploading = hasActiveUploads || hasQueuedUploads

  // Get current upload for status display - show banner only for meaningful phases
  const currentUpload = uploadsArray.find(u => 
    // must have a meaningful phase (not undefined/idle)
    ['uploading', 'finalizing', 'processing', 'ready', 'error'].includes(u.phase)
  )

  // Show ProcessingBanner only for uploads with real phases
  const showStatus = Boolean(currentUpload)

  // Use module status hook for processing uploads
  const processingUpload = uploadsArray.find(u => u.phase === 'processing')
  const { status: moduleStatus } = useModuleStatus(
    processingUpload?.moduleId || '', 
    !!processingUpload?.moduleId
  )

  // Update upload status when module processing completes
  useEffect(() => {
    console.log('🔍 Navigation Effect - Debug Info:', {
      totalUploads: uploads.size,
      uploadsArray: uploadsArray.map(u => ({ id: u.id, phase: u.phase, moduleId: u.moduleId })),
      processingUpload: processingUpload ? { id: processingUpload.id, moduleId: processingUpload.moduleId, phase: processingUpload.phase } : null,
      moduleStatus: moduleStatus ? { status: moduleStatus.status, success: moduleStatus.success } : null,
      hasModuleId: !!processingUpload?.moduleId
    })
    
    if (processingUpload && moduleStatus && processingUpload.moduleId) {
      if (moduleStatus.status === 'ready') {
        console.log('🎯 Upload complete! Navigating to training page:', processingUpload.moduleId)
        markReady(processingUpload.id)
        // Navigate to training page with voice start flag
        navigate(`/training/${processingUpload.moduleId}?voicestart=1`)
      } else if (moduleStatus.status === 'error') {
        console.error('❌ Upload processing failed for:', processingUpload.moduleId)
        markError(processingUpload.id, new Error('Processing failed'))
      } else {
        console.log('⏳ Still processing...', { status: moduleStatus.status })
      }
    }
  }, [processingUpload, moduleStatus, markReady, markError, navigate])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (import.meta.env.DEV) {
      console.log('Files dropped:', acceptedFiles)
    }
    
    // IMPORTANT: Prime mic inside the same click handler call stack
    primeMicOnce().catch(() => { /* ignore; we'll show a fallback later */ });
    
    for (const file of acceptedFiles) {
      try {
        if (import.meta.env.DEV) {
          console.log('Processing file:', file.name)
        }
        
        // Validate file
        const validation = await validateFile(file)
        if (!validation.valid) {
          throw new Error(validation.error)
        }

        // Add to upload queue
        const uploadId = addUpload(file)
        if (import.meta.env.DEV) {
          console.log('Added to queue:', uploadId)
        }

        // Upload will be started by the onPhaseChange callback

        // Start upload - USE DIRECT URL (bypasses proxy)
        try {
          if (import.meta.env.DEV) {
            console.log('Starting upload...')
          }
          
          // Start the upload status
          startUpload(uploadId)
          
          const response = await uploadWithProgress({
            file,
            url: API_ENDPOINTS.UPLOAD, // Use configured API endpoint
            onProgress: (progress) => {
              if (import.meta.env.DEV) {
                console.log(`Upload progress: ${progress}%`)
              }
              updateProgress(uploadId, progress)
            },
            onPhaseChange: (phase) => {
              if (import.meta.env.DEV) {
                console.log(`Phase change: ${phase}`)
              }
              setPhase(uploadId, phase)
            },
          })

          if (import.meta.env.DEV) {
            console.log('Upload response status:', response.status)
          }

          if (response.ok) {
            const result = await response.json()
            console.log('📦 Upload success response:', result)
            
            if (result.moduleId) {
              console.log('🎯 Setting moduleId and marking as processing:', result.moduleId)
              
              // FORCE NAVIGATION - NO CONDITIONS, NO DELAYS
              console.log('🚀 FORCING NAVIGATION NOW!')
              console.log('📍 Current location:', window.location.href)
              console.log('🎯 Target:', `/training/${result.moduleId}?voicestart=1`)
              
              // Try multiple navigation methods to be absolutely sure
              const targetUrl = `/training/${result.moduleId}?voicestart=1`
              
              // Method 1: React Router navigate
              navigate(targetUrl)
              console.log('✅ Method 1: React Router navigate() called')
              
              // Method 2: setTimeout backup (in case React Router is blocked)
              setTimeout(() => {
                if (window.location.pathname === '/upload') {
                  console.log('🔄 Method 2: Using window.location.href as backup')
                  window.location.href = targetUrl
                }
              }, 100)
              
              // Method 3: Immediate fallback
              setTimeout(() => {
                if (window.location.pathname === '/upload') {
                  console.log('🆘 Method 3: Emergency navigation!')
                  window.location.replace(targetUrl)
                }
              }, 500)
              
              // Update store for UI consistency
              setModuleId(uploadId, result.moduleId)
              markProcessing(uploadId)
              
            } else {
              console.error('❌ No moduleId in upload response:', result)
              throw new Error('Upload succeeded but no moduleId returned')
            }
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
      {/* Processing Banner - shows for all uploads including queued ones */}
      {showStatus && currentUpload && (
        <ProcessingBanner
          phase={currentUpload.phase}
          progress={currentUpload.progress}
          moduleId={currentUpload.moduleId}
        />
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
      {uploads.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Upload Queue</h3>
          
          {/* Upload Status Summary - show for all uploads */}
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
          
          {Array.from(uploads.entries()).map(([id, upload]) => (
            <UploadItem key={id} id={id} upload={upload} />
          ))}
        </div>
      )}
    </div>
  )
}
