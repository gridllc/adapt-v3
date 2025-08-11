import { UploadErrorType } from './uploadErrors'

// 🎯 Upload response interface
export interface UploadResponse {
  moduleId?: string
  status?: string
  message?: string
  [key: string]: any
}

// 🎯 Upload error interface
export interface UploadError {
  type: UploadErrorType | string
  message: string
  status?: number
  response?: any
}

// 🎯 Upload options interface
export interface UploadOptions {
  url?: string
  timeout?: number
  headers?: Record<string, string>
  onProgress?: (percent: number, loaded: number, total: number) => void
  signal?: AbortSignal
}

/**
 * 🎯 Upload file with real-time progress tracking
 * 
 * @param file - File to upload
 * @param onProgress - Progress callback (percent: number) => void
 * @param options - Upload options including URL, timeout, headers, etc.
 * @returns Promise<UploadResponse>
 */
export const uploadFileWithProgress = (
  file: File,
  onProgress: (percent: number) => void,
  options: UploadOptions = {}
): Promise<UploadResponse> => {
  const {
    url = '/api/upload',
    timeout = 60000, // 60 seconds default
    headers = {},
    signal
  } = options

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let isAborted = false

    // 🎯 Progress tracking
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && !isAborted) {
        const percent = Math.round((event.loaded / event.total) * 100)
        const loaded = event.loaded
        const total = event.total
        
        onProgress(percent)
        
        // 🎯 Call detailed progress if provided
        if (options.onProgress) {
          options.onProgress(percent, loaded, total)
        }
      }
    }

    // 🎯 State change handling
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE && !isAborted) {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            let response: UploadResponse
            
            try {
              response = JSON.parse(xhr.responseText)
            } catch {
              // 🎯 Handle non-JSON responses
              response = {
                status: 'success',
                message: xhr.responseText || 'Upload completed successfully',
                moduleId: `module_${Date.now()}`
              }
            }
            
            resolve(response)
          } else {
            // 🎯 Handle HTTP error responses
            let errorMessage = `Upload failed with status ${xhr.status}`
            let errorType = UploadErrorType.SERVER_ERROR
            
            try {
              const errorResponse = JSON.parse(xhr.responseText)
              errorMessage = errorResponse.message || errorMessage
              errorType = errorResponse.type || errorType
            } catch {
              // Use default error message if response is not JSON
            }
            
            reject({
              type: errorType,
              message: errorMessage,
              status: xhr.status,
              response: xhr.responseText
            })
          }
        } catch (error) {
          reject({
            type: UploadErrorType.SERVER_ERROR,
            message: 'Failed to parse server response',
            status: xhr.status
          })
        }
      }
    }

    // 🎯 Network error handling
    xhr.onerror = () => {
      if (!isAborted) {
        reject({
          type: UploadErrorType.NETWORK_TIMEOUT,
          message: 'Network error or timeout during upload.',
        })
      }
    }

    // 🎯 Timeout handling
    xhr.ontimeout = () => {
      if (!isAborted) {
        reject({
          type: UploadErrorType.NETWORK_TIMEOUT,
          message: 'Upload timed out. Please check your connection and try again.',
        })
      }
    }

    // 🎯 Abort handling
    xhr.onabort = () => {
      isAborted = true
      reject({
        type: UploadErrorType.USER_ABORT,
        message: 'Upload was canceled.',
      })
    }

    // 🎯 Setup XHR
    xhr.open('POST', url, true)
    xhr.timeout = timeout

    // 🎯 Set headers
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    // 🎯 Set default content type for FormData
    // Note: Don't set Content-Type for FormData - browser will set it with boundary
    if (!headers['Content-Type']) {
      // Let browser set the correct Content-Type for FormData
    }

    // 🎯 Abort signal handling
    if (signal) {
      signal.addEventListener('abort', () => {
        isAborted = true
        xhr.abort()
      })
    }

    // 🎯 Prepare form data
    const formData = new FormData()
    formData.append('file', file)
    
    // 🎯 Add any additional fields if needed
    // formData.append('userId', userId)
    // formData.append('metadata', JSON.stringify(metadata))

    // 🎯 Send request
    try {
      xhr.send(formData)
    } catch (error) {
      reject({
        type: UploadErrorType.NETWORK_TIMEOUT,
        message: 'Failed to start upload. Please check your connection.',
      })
    }
  })
}

/**
 * 🎯 Enhanced upload with retry logic built-in
 * 
 * @param file - File to upload
 * @param onProgress - Progress callback
 * @param options - Upload options
 * @param retryConfig - Retry configuration
 * @returns Promise<UploadResponse>
 */
export const uploadFileWithRetry = async (
  file: File,
  onProgress: (percent: number) => void,
  options: UploadOptions = {},
  retryConfig: {
    maxAttempts?: number
    baseDelay?: number
    maxDelay?: number
  } = {}
): Promise<UploadResponse> => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 8000
  } = retryConfig

  let lastError: UploadError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await uploadFileWithProgress(file, onProgress, options)
    } catch (error: any) {
      lastError = error
      
      // 🎯 Check if error is retryable
      const isRetryable = error.type === UploadErrorType.NETWORK_TIMEOUT || 
                         error.type === UploadErrorType.SERVER_ERROR
      
      if (attempt < maxAttempts && isRetryable) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        console.log(`🔄 Upload attempt ${attempt} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // 🎯 Final failure
      throw lastError
    }
  }
  
  throw lastError!
}

/**
 * 🎯 Upload multiple files with progress tracking
 * 
 * @param files - Array of files to upload
 * @param onProgress - Progress callback for each file
 * @param options - Upload options
 * @returns Promise<UploadResponse[]>
 */
export const uploadMultipleFiles = async (
  files: File[],
  onProgress: (fileIndex: number, percent: number) => void,
  options: UploadOptions = {}
): Promise<UploadResponse[]> => {
  const results: UploadResponse[] = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const result = await uploadFileWithProgress(
      file,
      (percent) => onProgress(i, percent),
      options
    )
    results.push(result)
  }
  
  return results
}

/**
 * 🎯 Validate file before upload
 * 
 * @param file - File to validate
 * @param options - Validation options
 * @returns { isValid: boolean, error?: string }
 */
export const validateFileForUpload = (
  file: File,
  options: {
    maxSize?: number // in bytes
    allowedTypes?: string[]
    maxDuration?: number // for videos, in seconds
  } = {}
): { isValid: boolean; error?: string } => {
  const { maxSize = 100 * 1024 * 1024, allowedTypes = ['video/*'] } = options

  // 🎯 Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
    }
  }

  // 🎯 Check file type
  const isAllowedType = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const baseType = type.replace('/*', '')
      return file.type.startsWith(baseType)
    }
    return file.type === type
  })

  if (!isAllowedType) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    }
  }

  return { isValid: true }
}

/**
 * 🎯 Helper function for file size formatting
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default uploadFileWithProgress 