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
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  
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

        // Normalize Content-Type for Android compatibility
        const normalizeContentType = (file: File): string => {
          const type = file.type.toLowerCase()
          if (type.includes('mp4')) return 'video/mp4'
          if (type.includes('webm')) return 'video/webm'
          if (type.includes('avi')) return 'video/x-msvideo'
          if (type.includes('mov') || type.includes('quicktime')) return 'video/quicktime'
          // Fallback to generic video type
          return 'video/mp4'
        }

        const contentType = normalizeContentType(file)
        console.log(`📹 Uploading video: ${file.name} (${contentType})`)

        // 🎯 SHOW SPINNER IMMEDIATELY HERE - Don't wait for backend
        setShowProcessing(true)
        // Don't set justUploadedModuleId yet - wait for real moduleId from backend

        // Start upload - USE PRESIGNED UPLOAD FLOW
        try {
          console.log('Starting presigned upload...')
          
          // Start the upload status
          startUpload(uploadId)
          
          // Step 1: Get presigned URL from backend
          updateProgress(uploadId, 10)
          const presignedResponse = await fetch('/api/presigned-upload/presigned-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          })

          if (!presignedResponse.ok) {
            const errorText = await presignedResponse.text()
            throw new Error(`Failed to get presigned URL: ${presignedResponse.status} - ${errorText}`)
          }

          const { uploadUrl, key, moduleId } = await presignedResponse.json()
          console.log('Got presigned URL:', uploadUrl)
          console.log('S3 key:', key)
          console.log('Module ID:', moduleId)

          // Step 2: Upload directly to S3 using presigned URL
          updateProgress(uploadId, 30)
          const s3Response = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 
              'Content-Type': file.type || 'video/mp4' // MUST match the presigned ContentType exactly
            },
            // DO NOT send any other headers (no x-amz-acl unless signed for it)
          })

          if (!s3Response.ok) {
            const errorText = await s3Response.text()
            throw new Error(`S3 upload failed: ${s3Response.status} - ${errorText}`)
          }

          console.log('S3 upload successful')

          // Step 3: Complete upload with backend (triggers AI pipeline)
          updateProgress(uploadId, 60)
          const completeResponse = await fetch('/api/upload/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              moduleId: moduleId,
              key: key,
              filename: file.name,
              contentType: contentType,
              size: file.size,
            }),
          })

          if (!completeResponse.ok) {
            const errorText = await completeResponse.text()
            throw new Error(`Upload completion failed: ${completeResponse.status} - ${errorText}`)
          }

          const completeResult = await completeResponse.json()
          console.log('Upload completed:', completeResult)

          // Generate playback URL for video player
          try {
            const playbackResponse = await fetch('/api/presigned-upload/playback-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key })
            })
            
            if (playbackResponse.ok) {
              const { playbackUrl } = await playbackResponse.json()
              console.log('Generated playback URL:', playbackUrl)
              // Store this URL for the video player
              setVideoUrl(playbackUrl)
            }
          } catch (error) {
            console.warn('Failed to generate playback URL:', error)
          }

          // 🎯 SET REAL MODULE ID HERE - before AI processing starts
          setJustUploadedModuleId(moduleId)

          // Mark upload as successful
          updateProgress(uploadId, 100)
          markSuccess(uploadId, moduleId)
          
          // Navigate to training page with processing flag
          navigate(`/training/${moduleId}?processing=true`)

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
      {showProcessing && (
        <div className="mt-4 mb-6 rounded-xl border p-4 bg-white/70">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-gray-300 border-t-transparent" />
            <div className="font-medium">
              {status === "FAILED" ? "Processing failed" : "Processing your video…"}
            </div>
          </div>

          {status !== "FAILED" && (
            <div className="mt-3">
              {justUploadedModuleId ? (
                <>
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
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Uploading video and starting AI processing...
                </div>
              )}
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
                  {hasActiveUploads ? 'Uploading to S3...' : 'Preparing upload...'}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {hasActiveUploads 
                  ? 'Your video is being uploaded directly to S3'
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
