import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createMultipartUpload, MultipartUploadConfig } from '../../utils/multipartUpload'
import { validateFileForMultipart, isMultipartSupported } from '../../utils/multipartService'

interface MultipartUploadProps {
  file: File
  onSuccess: (result: any) => void
  onCancel?: () => void
  onError?: (error: Error) => void
  className?: string
}

interface PartProgress {
  partNumber: number
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
}

export const MultipartUploadManager: React.FC<MultipartUploadProps> = ({
  file,
  onSuccess,
  onCancel,
  onError,
  className = ''
}) => {
  const [overallProgress, setOverallProgress] = useState(0)
  const [status, setStatus] = useState('Initializing...')
  const [parts, setParts] = useState<PartProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadManager, setUploadManager] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showParts, setShowParts] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Initialize multipart upload
  useEffect(() => {
    if (!isMultipartSupported()) {
      setError('Multipart uploads are not supported in this browser')
      return
    }

    // Validate file
    const validation = validateFileForMultipart(file)
    if (!validation.isValid) {
      setError(validation.error || 'File validation failed')
      return
    }

    // Create upload manager
    const config: MultipartUploadConfig = {
      maxConcurrent: 4,
      maxRetries: 3,
      retryDelay: 1000,
      onProgress: (progress, loaded, total) => {
        setOverallProgress(progress)
        setStatus(`Uploading... ${progress.toFixed(1)}%`)
      },
      onPartProgress: (partNumber, progress) => {
        setParts(prev => prev.map(part => 
          part.partNumber === partNumber 
            ? { ...part, progress, status: progress === 100 ? 'completed' : 'uploading' }
            : part
        ))
      }
    }

    const manager = createMultipartUpload(file, file.name, file.type, config)
    setUploadManager(manager)

    // Initialize parts array
    const estimatedPartCount = Math.ceil(file.size / (8 * 1024 * 1024)) // Estimate 8MB parts
    const initialParts: PartProgress[] = Array.from({ length: estimatedPartCount }, (_, i) => ({
      partNumber: i + 1,
      progress: 0,
      status: 'pending'
    }))
    setParts(initialParts)
  }, [file])

  // Start upload
  const startUpload = useCallback(async () => {
    if (!uploadManager) return

    try {
      setIsUploading(true)
      setError(null)
      setStatus('Starting multipart upload...')

      // Create abort controller
      const controller = new AbortController()
      abortControllerRef.current = controller

      const result = await uploadManager.start()
      
      setStatus('Upload completed successfully!')
      setOverallProgress(100)
      onSuccess(result)
    } catch (err: any) {
      if (err.message === 'Upload was cancelled') {
        setStatus('Upload was cancelled')
      } else {
        setError(err.message || 'Upload failed')
        onError?.(err)
      }
    } finally {
      setIsUploading(false)
    }
  }, [uploadManager, onSuccess, onError])

  // Cancel upload
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (uploadManager) {
      uploadManager.abort()
    }
    onCancel?.()
  }, [uploadManager, onCancel])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get status color
  const getStatusColor = (status: PartProgress['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'uploading': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Multipart Upload</h3>
          <p className="text-sm text-gray-500">
            {file.name} ({formatFileSize(file.size)})
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowParts(!showParts)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showParts ? 'Hide Parts' : 'Show Parts'}
          </button>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{overallProgress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">{status}</p>
      </div>

      {/* Parts Progress */}
      {showParts && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Upload Parts</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {parts.map((part) => (
              <div key={part.partNumber} className="text-center">
                <div className="relative">
                  <div className="w-12 h-12 mx-auto rounded-full border-2 border-gray-200 flex items-center justify-center">
                    <div className={`w-8 h-8 rounded-full ${getStatusColor(part.status)} transition-all duration-300`} />
                  </div>
                  {part.progress > 0 && part.progress < 100 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-white font-medium">
                        {part.progress.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">Part {part.partNumber}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        {!isUploading ? (
          <button
            onClick={startUpload}
            disabled={!uploadManager}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Upload
          </button>
        ) : (
          <button
            onClick={cancelUpload}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Cancel Upload
          </button>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Multipart Upload Benefits</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Reliable uploads for large files</li>
                <li>Resume capability if interrupted</li>
                <li>Parallel uploads for faster completion</li>
                <li>Mobile-optimized part sizes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
