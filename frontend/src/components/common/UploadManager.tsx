import React, { useState, useRef, useCallback, useEffect } from 'react'
import { EnhancedUploadProgress } from './EnhancedUploadProgress'
import { UploadErrorType, isRetryableError, calculateRetryDelay, createFinalRetryError } from '../utils/uploadErrors'
import { uploadFileWithProgress, UploadResponse, UploadOptions } from '../utils/uploadFileWithProgress'

// 🎯 TypeScript interfaces for full type safety
interface UploadError {
  title: string
  message: string
  action?: string
  type?: UploadErrorType
  severity?: 'low' | 'medium' | 'high'
}

interface UploadResponse {
  moduleId?: string
  status?: string
  [key: string]: any
}

interface Props {
  file: File
  onSuccess: (response: UploadResponse) => void
  onCancel?: () => void
  onError?: (error: UploadError) => void
  performUpload?: (file: File, onProgress?: (progress: number) => void) => Promise<UploadResponse>
  uploadOptions?: UploadOptions
  maxAttempts?: number
  autoStart?: boolean
  className?: string
}

export const UploadManager: React.FC<Props> = ({
  file,
  onSuccess,
  onCancel,
  onError,
  performUpload,
  uploadOptions = {},
  maxAttempts = 3,
  autoStart = true,
  className = ''
}) => {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Waiting to upload')
  const [error, setError] = useState<UploadError | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 🎯 Enhanced upload with retry logic
  const uploadWithRetry = useCallback(async (attempt = 1): Promise<void> => {
    try {
      setIsUploading(true)
      setError(null)
      setAttemptCount(attempt)
      setStatus(`Uploading... (Attempt ${attempt}/${maxAttempts})`)
      setProgress(0)

      const controller = new AbortController()
      abortControllerRef.current = controller

      // 🎯 Progress tracking function
      const handleProgress = (progressValue: number) => {
        setProgress(progressValue)
        if (progressValue < 100) {
          setStatus(`Uploading... ${progressValue.toFixed(1)}%`)
        }
      }

      // 🎯 Perform the actual upload
      const result = performUpload 
        ? await performUpload(file, handleProgress)
        : await uploadFileWithProgress(file, handleProgress, {
            ...uploadOptions,
            signal: controller.signal
          })

      setProgress(100)
      setStatus('Upload complete')
      setIsUploading(false)
      setAttemptCount(0)
      onSuccess(result)
    } catch (err: any) {
      console.error(`🚨 Upload attempt ${attempt} failed:`, err)

      // 🎯 Check if error is retryable
      const isRetryable = isRetryableError(err) || 
                         err.type === UploadErrorType.NETWORK_TIMEOUT || 
                         err.type === UploadErrorType.SERVER_ERROR

      if (attempt < maxAttempts && isRetryable) {
        const delay = calculateRetryDelay(attempt, progress)
        setStatus(`Retrying in ${(delay / 1000).toFixed(1)}s...`)
        setRetryCountdown(Math.ceil(delay / 1000))
        
        // 🎯 Countdown timer
        const countdownInterval = setInterval(() => {
          setRetryCountdown(prev => {
            if (prev && prev > 1) {
              return prev - 1
            } else {
              clearInterval(countdownInterval)
              return null
            }
          })
        }, 1000)

        retryTimeoutRef.current = setTimeout(() => {
          clearInterval(countdownInterval)
          setRetryCountdown(null)
          return uploadWithRetry(attempt + 1)
        }, delay)

        return
      }

      // 🎯 Final failure - create comprehensive error
      const finalError = createFinalRetryError(err, attempt)
      const uploadError: UploadError = {
        title: finalError.title || 'Upload Failed',
        message: finalError.message || 'The upload could not be completed after multiple attempts.',
        action: attempt > 1 ? `Failed after ${attempt} attempts. Try again or contact support.` : 'Try again or check your connection.',
        type: finalError.type,
        severity: attempt > 1 ? 'high' : 'medium'
      }

      setError(uploadError)
      setIsUploading(false)
      setStatus('Upload failed')
      setAttemptCount(0)
      setRetryCountdown(null)
      onError?.(uploadError)
    }
  }, [file, onSuccess, onError, performUpload, maxAttempts, progress])

  // 🎯 Handle retry button click
  const handleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    setRetryCountdown(null)
    setProgress(0)
    setStatus('Retrying...')
    uploadWithRetry(1)
  }, [uploadWithRetry])

  // 🎯 Handle cancel button click
  const handleCancel = useCallback(() => {
    // 🎯 Abort current upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // 🎯 Clear retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    setIsUploading(false)
    setStatus('Upload canceled')
    setError(null)
    setAttemptCount(0)
    setRetryCountdown(null)
    onCancel?.()
  }, [onCancel])

  // 🎯 Auto-start upload on mount if enabled
  useEffect(() => {
    if (autoStart && file) {
      uploadWithRetry(1)
    }
  }, [autoStart, file, uploadWithRetry])

  // 🎯 Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  // 🎯 Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 🎯 Enhanced status message with retry info
  const getEnhancedStatus = (): string => {
    if (retryCountdown) {
      return `Retrying in ${retryCountdown}s...`
    }
    if (attemptCount > 1) {
      return `${status} (Attempt ${attemptCount}/${maxAttempts})`
    }
    return status
  }

  return (
    <div className={`w-full max-w-xl ${className}`}>
      <EnhancedUploadProgress 
        progress={progress} 
        status={getEnhancedStatus()}
        error={error} 
        fileName={file.name}
        fileSize={file.size}
        onRetry={handleRetry} 
        onCancel={handleCancel}
      />
      
      {/* 🎯 Additional retry info */}
      {attemptCount > 1 && !error && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <span className="font-medium">Retry attempt:</span>
            <span>{attemptCount}/{maxAttempts}</span>
            {retryCountdown && (
              <>
                <span>•</span>
                <span>Next attempt in {retryCountdown}s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 🎯 File info display */}
      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className="font-medium">File:</span>
          <span className="truncate ml-2">{file.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
          <span className="font-medium">Size:</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
          <span className="font-medium">Type:</span>
          <span>{file.type || 'Unknown'}</span>
        </div>
      </div>
    </div>
  )
}

// 🎯 Convenience wrapper for simple uploads
export const SimpleUploadManager: React.FC<Omit<Props, 'autoStart'> & { autoStart?: boolean }> = (props) => {
  return <UploadManager {...props} autoStart={props.autoStart ?? true} />
}

// 🎯 Manual upload manager (requires manual start)
export const ManualUploadManager: React.FC<Omit<Props, 'autoStart'> & { onStart?: () => void }> = ({ 
  onStart, 
  ...props 
}) => {
  const [isStarted, setIsStarted] = useState(false)

  const handleStart = () => {
    setIsStarted(true)
    onStart?.()
  }

  if (!isStarted) {
    return (
      <div className="w-full max-w-xl p-6 bg-white rounded-lg border shadow-sm">
        <div className="text-center space-y-4">
          <div className="text-2xl">📁</div>
          <h3 className="text-lg font-semibold text-gray-900">Ready to Upload</h3>
          <p className="text-sm text-gray-600">
            {props.file.name} ({formatFileSize(props.file.size)})
          </p>
          <button
            onClick={handleStart}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Upload
          </button>
        </div>
      </div>
    )
  }

  return <UploadManager {...props} autoStart={true} />
}

// 🎯 Helper function for file size formatting
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default UploadManager 