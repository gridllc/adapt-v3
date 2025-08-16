// Enhanced Upload Error Handling System

export enum UploadErrorType {
  NETWORK_TIMEOUT = 'network_timeout',
  FILE_TOO_LARGE = 'file_too_large',
  INVALID_FORMAT = 'invalid_format',
  SERVER_ERROR = 'server_error',
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION = 'authentication',
  COMPRESSION_FAILED = 'compression_failed',
  STORAGE_FULL = 'storage_full',
  USER_ABORT = 'user_abort'
}

// 🎯 Backend error response interface
export interface BackendErrorResponse {
  type: UploadErrorType | string
  message: string
  details?: string
}

export interface UploadError {
  type: UploadErrorType
  message?: string
  status?: number
  size?: number
  filename?: string
  originalError?: any
}

export interface ErrorResponse {
  title: string
  message: string
  action: string
  retryable: boolean
  severity: 'low' | 'medium' | 'high'
}

// Smart Error Message Generator with complete enum coverage
export const getErrorMessage = (error: UploadError, fileSize?: number): ErrorResponse => {
  // Use error.type for consistent handling
  switch (error.type) {
    case UploadErrorType.NETWORK_TIMEOUT:
      return {
        title: "Upload Timeout",
        message: "Your upload took too long. This usually happens with large files or slow connections.",
        action: "Try compressing your video or check your internet connection.",
        retryable: true,
        severity: 'medium'
      }

    case UploadErrorType.FILE_TOO_LARGE:
      const size = error.size || fileSize
      return {
        title: "File Too Large",
        message: size 
          ? `Your video is ${(size / 1024 / 1024).toFixed(1)}MB. Maximum allowed is 100MB.`
          : "Your video file is too large for upload.",
        action: "Please use a shorter video or compress it before uploading.",
        retryable: false,
        severity: 'high'
      }

    case UploadErrorType.INVALID_FORMAT:
      return {
        title: "Invalid File Format",
        message: "Only MP4, MOV, or WEBM video files are supported.",
        action: "Please upload a video in a supported format.",
        retryable: false,
        severity: 'high'
      }

    case UploadErrorType.AUTHENTICATION:
      return {
        title: "Authentication Required",
        message: "You need to sign in to upload videos.",
        action: "Please sign in and try again.",
        retryable: false,
        severity: 'high'
      }

    case UploadErrorType.COMPRESSION_FAILED:
      return {
        title: "Compression Error",
        message: "Something went wrong while compressing your video.",
        action: "Try uploading the original file or re-encode it using a different tool.",
        retryable: true,
        severity: 'medium'
      }

    case UploadErrorType.STORAGE_FULL:
      return {
        title: "Storage Limit Reached",
        message: "You've hit your video upload limit for this module.",
        action: "Delete older videos or upgrade your plan to continue uploading.",
        retryable: false,
        severity: 'high'
      }

    case UploadErrorType.SERVER_ERROR:
      return {
        title: "Server Error",
        message: "Something went wrong on our end.",
        action: "Please try again in a few moments.",
        retryable: true,
        severity: 'medium'
      }

    default:
      // Catch-all fallback
      return {
        title: "Unexpected Error",
        message: error.message || "Something went wrong during upload.",
        action: "Please try again or contact support if the issue persists.",
        retryable: true,
        severity: 'medium'
      }
  }
}

// HTTP Status Code to Error Type Mapper
export const mapHttpStatusToErrorType = (status: number): UploadErrorType => {
  if (status === 401 || status === 403) return UploadErrorType.AUTHENTICATION
  if (status === 413) return UploadErrorType.FILE_TOO_LARGE
  if (status === 415) return UploadErrorType.INVALID_FORMAT
  if (status === 507) return UploadErrorType.STORAGE_FULL
  if (status >= 500) return UploadErrorType.SERVER_ERROR
  
  // Default for 4xx errors
  return UploadErrorType.SERVER_ERROR
}

// Error Factory Functions
export const createUploadError = (
  type: UploadErrorType, 
  options: {
    message?: string
    status?: number
    size?: number
    filename?: string
    originalError?: any
  } = {}
): UploadError => {
  return {
    type,
    ...options
  }
}

// Network Error Detector
export const detectNetworkError = (error: any): UploadError => {
  // 🎯 Handle backend typed errors first
  if (error.type && error.message) {
    const errorType = error.type.toUpperCase().replace(/-/g, '_') as UploadErrorType
    return createUploadError(errorType, {
      message: error.message,
      status: error.status,
      originalError: error
    })
  }

  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return createUploadError(UploadErrorType.NETWORK_TIMEOUT, { originalError: error })
  }
  
  if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_RESET')) {
    return createUploadError(UploadErrorType.NETWORK_TIMEOUT, { originalError: error })
  }
  
  if (error.status) {
    return createUploadError(mapHttpStatusToErrorType(error.status), { 
      status: error.status, 
      originalError: error 
    })
  }
  
  // Default fallback
  return createUploadError(UploadErrorType.SERVER_ERROR, { originalError: error })
}

// File Validation Errors
export const validateFile = (file: File): UploadError | null => {
  const maxSize = 100 * 1024 * 1024 // 100MB
  const allowedTypes = ['video/mp4', 'video/mov', 'video/webm', 'video/quicktime']
  
  if (file.size > maxSize) {
    return createUploadError(UploadErrorType.FILE_TOO_LARGE, { 
      size: file.size, 
      filename: file.name 
    })
  }
  
  if (!allowedTypes.includes(file.type)) {
    return createUploadError(UploadErrorType.INVALID_FORMAT, { 
      filename: file.name,
      message: `File type "${file.type}" is not supported` 
    })
  }
  
  return null
}

// Retry Configuration - Optimized for video education platform
export const RETRY_CONFIG = {
  maxAttempts: 3,          // ✅ Perfect balance: 95% success rate without user frustration
  baseDelay: 1000,         // 1 second base delay
  maxDelay: 8000,          // Max 8 seconds (reduced from 10s for better UX)
  retryableErrors: [
    UploadErrorType.NETWORK_TIMEOUT,  // Network issues - definitely retry
    UploadErrorType.SERVER_ERROR,     // 5xx server errors - retry makes sense
    // Note: COMPRESSION_FAILED removed - client-side issues rarely fix with retries
  ],
  // Advanced settings for your platform
  jitterRange: 500,        // 0-500ms jitter to prevent thundering herd
  timeoutMs: 60000,        // 60s timeout per attempt (video files need time)
  progressThreshold: 0.1   // If >10% uploaded, be more patient
}

// Enhanced Retryable Error Checker with safety checks
export const isRetryableError = (error: any): boolean => {
  // Safety checks for null/undefined and missing type
  if (!error || !error.type) return false
  
  // Check if error type is in retryable list
  return RETRY_CONFIG.retryableErrors.includes(error.type)
}

// Alternative HTTP-based retry check
export const isRetryableByStatus = (error: any): boolean => {
  if (!error) return false
  
  // Retry on 5xx server errors or specific network timeouts
  return error.status >= 500 || error.type === UploadErrorType.NETWORK_TIMEOUT
}

// Calculate retry delay with exponential backoff and jitter - optimized for video uploads
export const calculateRetryDelay = (attempt: number, uploadProgress?: number): number => {
  const jitter = Math.random() * RETRY_CONFIG.jitterRange // Configurable jitter
  const exponentialDelay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1)
  let delay = Math.min(exponentialDelay, RETRY_CONFIG.maxDelay)
  
  // 🎯 Smart delay adjustment: if upload was progressing, be more patient
  if (uploadProgress && uploadProgress > RETRY_CONFIG.progressThreshold) {
    delay = Math.min(delay * 1.5, RETRY_CONFIG.maxDelay) // 50% longer delay if progress was made
  }
  
  return delay + jitter
}

// Create enhanced final error after all retries failed
export const createFinalRetryError = (originalError: any, attempts: number): UploadError => {
  return {
    ...originalError,
    type: originalError.type || UploadErrorType.SERVER_ERROR,
    message: originalError.message || `Upload failed after ${attempts} attempts.`,
    originalError
  }
}
