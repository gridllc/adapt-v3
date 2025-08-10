import React, { useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadItem } from './UploadItem'
import { useUploadStore } from '@stores/uploadStore'
import { AuthenticatedMultipartUploadManager as MultipartUploader } from '@utils/multipartUploadWithAuth'
import { useAuthToken } from '@hooks/useAuthToken'
import { Upload, Cloud, AlertCircle } from 'lucide-react'

export const MultipartUploadManager: React.FC = () => {
  const { 
    uploads, 
    addUpload, 
    updateUpload, 
    updatePartProgress, 
    markPartComplete, 
    markPartError,
    getQueuedUploads,
    getActiveUploads,
    getCompletedUploads,
    getFailedUploads,
    clearCompletedUploads,
    clearAllUploads
  } = useUploadStore()

  const { getAuthToken, isSignedIn } = useAuthToken()
  const activeUploadsRef = useRef<Map<string, MultipartUploader>>(new Map())

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        console.warn(`Skipping non-video file: ${file.name}`)
        return
      }

      // Add to upload queue
      const uploadId = addUpload(file)
      console.log(`Added upload: ${uploadId} for file: ${file.name}`)
    })
  }, [addUpload])

  const startUpload = useCallback(async (uploadId: string) => {
    const upload = uploads.get(uploadId)
    if (!upload || upload.status !== 'queued') return

    // Check authentication
    if (!isSignedIn) {
      updateUpload(uploadId, { 
        status: 'error',
        error: 'You must be signed in to upload files'
      })
      return
    }

    try {
      // Get auth token
      const authToken = await getAuthToken()
      if (!authToken) {
        updateUpload(uploadId, { 
          status: 'error',
          error: 'Failed to get authentication token'
        })
        return
      }

      // Update status to uploading
      updateUpload(uploadId, { 
        status: 'uploading', 
        startedAt: new Date() 
      })

      // Create multipart uploader
      const abortController = new AbortController()
      const uploader = new MultipartUploader(
        upload.file,
        upload.file.name,
        upload.file.type,
        {
          authToken,
          onProgress: (progress) => {
            updateUpload(uploadId, { progress })
          },
          signal: abortController.signal
        }
      )

      // Store reference for potential cancellation
      activeUploadsRef.current.set(uploadId, uploader)

      // Start the upload
      const result = await uploader.start()
      
      // Handle success
      updateUpload(uploadId, { 
        status: 'success',
        completedAt: new Date(),
        moduleId: result.moduleId,
        key: result.key,
        progress: 100
      })
      
      // Clean up uploader reference
      activeUploadsRef.current.delete(uploadId)

    } catch (error) {
      console.error(`Failed to start upload ${uploadId}:`, error)
      updateUpload(uploadId, { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Clean up uploader reference
      activeUploadsRef.current.delete(uploadId)
    }
  }, [uploads, updateUpload, getAuthToken, isSignedIn])

  const cancelUpload = useCallback((uploadId: string) => {
    const uploader = activeUploadsRef.current.get(uploadId)
    if (uploader) {
      uploader.abort()
      activeUploadsRef.current.delete(uploadId)
    }
    
    updateUpload(uploadId, { 
      status: 'canceled',
      progress: 0
    })
  }, [updateUpload])

  const retryUpload = useCallback((uploadId: string) => {
    const upload = uploads.get(uploadId)
    if (!upload || upload.status !== 'error') return

    // Reset upload state
    updateUpload(uploadId, {
      status: 'queued',
      progress: 0,
      error: undefined,
      attempts: upload.attempts + 1
    })

    // Start upload again
    startUpload(uploadId)
  }, [uploads, updateUpload, startUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv']
    },
    multiple: true,
    maxSize: 2 * 1024 * 1024 * 1024 // 2GB max
  })

  const queuedUploads = getQueuedUploads()
  const activeUploads = getActiveUploads()
  const completedUploads = getCompletedUploads()
  const failedUploads = getFailedUploads()

  // Auto-start queued uploads when there's capacity
  React.useEffect(() => {
    const maxConcurrent = 3
    const availableSlots = maxConcurrent - activeUploads.length
    
    if (availableSlots > 0 && queuedUploads.length > 0) {
      const uploadsToStart = queuedUploads.slice(0, availableSlots)
      uploadsToStart.forEach(upload => {
        startUpload(upload.id)
      })
    }
  }, [queuedUploads, activeUploads, startUpload])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Video Upload Manager
        </h1>
        <p className="text-gray-600">
          Upload your training videos using multipart upload for reliable large file handling
        </p>
        
        {!isSignedIn && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
              <p className="text-yellow-800">
                You must be signed in to upload files. Please sign in to continue.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isDragActive ? (
            <Cloud className="w-12 h-12 text-blue-500" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400" />
          )}
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop your videos here' : 'Drag & drop videos here'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse files
            </p>
          </div>
          
          <p className="text-xs text-gray-400">
            Supports MP4, AVI, MOV, MKV, WebM, FLV • Max 2GB per file
          </p>
        </div>
      </div>

      {/* Upload Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{queuedUploads.length}</div>
          <div className="text-sm text-blue-800">Queued</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{activeUploads.length}</div>
          <div className="text-sm text-yellow-800">Active</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{completedUploads.length}</div>
          <div className="text-sm text-green-800">Completed</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{failedUploads.length}</div>
          <div className="text-sm text-red-800">Failed</div>
        </div>
      </div>

      {/* Upload List */}
      <div className="space-y-4">
        {/* Active Uploads */}
        {activeUploads.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Active Uploads</h2>
            <div className="space-y-3">
              {activeUploads.map(upload => (
                <UploadItem key={upload.id} id={upload.id} upload={upload} />
              ))}
            </div>
          </div>
        )}

        {/* Queued Uploads */}
        {queuedUploads.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Queued Uploads</h2>
            <div className="space-y-3">
              {queuedUploads.map(upload => (
                <UploadItem key={upload.id} id={upload.id} upload={upload} />
              ))}
            </div>
          </div>
        )}

        {/* Failed Uploads */}
        {failedUploads.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Failed Uploads</h2>
              <button
                onClick={() => failedUploads.forEach(upload => retryUpload(upload.id))}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Retry All
              </button>
            </div>
            <div className="space-y-3">
              {failedUploads.map(upload => (
                <UploadItem key={upload.id} id={upload.id} upload={upload} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Uploads */}
        {completedUploads.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Completed Uploads</h2>
              <button
                onClick={clearCompletedUploads}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-3">
              {completedUploads.map(upload => (
                <UploadItem key={upload.id} id={upload.id} upload={upload} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {uploads.size === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No uploads yet. Drop some videos to get started!</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {uploads.size > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Total uploads: {uploads.size}
            </div>
            <div className="space-x-3">
              <button
                onClick={clearCompletedUploads}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Clear Completed
              </button>
              <button
                onClick={clearAllUploads}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
