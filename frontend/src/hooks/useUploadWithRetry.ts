import { useState, useCallback } from 'react'
import { 
  UploadError, 
  RETRY_CONFIG, 
  isRetryableError, 
  calculateRetryDelay, 
  createFinalRetryError,
  detectNetworkError,
  getErrorMessage,
  UploadErrorType
} from '../utils/uploadErrors'

interface UploadOptions {
  file: File
  onProgress?: (progress: number) => void
  onStatusChange?: (status: string) => void
  onRetryAttempt?: (attempt: number, delay: number) => void
}

interface UploadState {
  isUploading: boolean
  progress: number
  status: string
  error: UploadError | null
  retryCount: number
}

export const useUploadWithRetry = () => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    status: 'idle',
    error: null,
    retryCount: 0
  })

  // Enhanced upload function with automatic retry logic
  const uploadWithRetry = useCallback(async (
    uploadFunction: (file: File, onProgress?: (progress: number) => void) => Promise<any>,
    options: UploadOptions,
    attempt: number = 1
  ): Promise<any> => {
    
    const { file, onProgress, onStatusChange, onRetryAttempt } = options

    try {
      // Update status
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        status: attempt === 1 ? 'uploading' : `retrying (${attempt}/${RETRY_CONFIG.maxAttempts})`,
        error: null,
        retryCount: attempt - 1
      }))

      onStatusChange?.(attempt === 1 ? 'uploading' : `retrying (${attempt}/${RETRY_CONFIG.maxAttempts})`)

      // Perform the actual upload
      const result = await uploadFunction(file, (progress) => {
        setUploadState(prev => ({ ...prev, progress }))
        onProgress?.(progress)
      })

      // Success - reset state
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        status: 'success',
        progress: 100,
        error: null
      }))

      return result

    } catch (err: any) {
      console.error(`❌ Upload attempt ${attempt} failed:`, err)
      
      // Convert to typed error
      const uploadError = detectNetworkError(err)
      
      // Check if we should retry
      if (attempt < RETRY_CONFIG.maxAttempts && isRetryableError(uploadError)) {
        const delay = calculateRetryDelay(attempt)
        
        console.log(`🔄 Retrying upload in ${(delay / 1000).toFixed(1)}s (Attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts})`)
        
        // Update state for retry countdown
        setUploadState(prev => ({
          ...prev,
          status: `retrying in ${(delay / 1000).toFixed(1)}s`,
          retryCount: attempt
        }))

        // Notify about retry attempt
        onRetryAttempt?.(attempt + 1, delay)
        onStatusChange?.(`retrying in ${(delay / 1000).toFixed(1)}s`)

        // Wait for delay with jitter
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // Recursive retry
        return uploadWithRetry(uploadFunction, options, attempt + 1)
      }

      // Final failure - create enhanced error
      const finalError = createFinalRetryError(uploadError, attempt)
      
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        status: 'error',
        error: finalError,
        retryCount: attempt
      }))

      throw finalError
    }
  }, [])

  // Manual retry function
  const retryUpload = useCallback(async (
    uploadFunction: (file: File, onProgress?: (progress: number) => void) => Promise<any>,
    options: UploadOptions
  ) => {
    // Reset retry count and try again
    setUploadState(prev => ({ ...prev, retryCount: 0 }))
    return uploadWithRetry(uploadFunction, options, 1)
  }, [uploadWithRetry])

  // Reset upload state
  const resetUpload = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: 0,
      status: 'idle',
      error: null,
      retryCount: 0
    })
  }, [])

  // Check if current error is retryable
  const canRetry = uploadState.error && isRetryableError(uploadState.error) && uploadState.retryCount < RETRY_CONFIG.maxAttempts

  return {
    uploadState,
    uploadWithRetry,
    retryUpload,
    resetUpload,
    canRetry,
    // Utility functions
    getErrorMessage: (error: UploadError, fileSize?: number) => getErrorMessage(error, fileSize),
    isRetryableError
  }
}

// Standalone upload with retry function (for direct use)
export const performUploadWithRetry = async (
  uploadFunction: (file: File, onProgress?: (progress: number) => void) => Promise<any>,
  file: File,
  options: {
    onProgress?: (progress: number) => void
    onStatusChange?: (status: string) => void
    onRetryAttempt?: (attempt: number, delay: number) => void
    maxAttempts?: number
  } = {}
): Promise<any> => {
  const maxAttempts = options.maxAttempts || RETRY_CONFIG.maxAttempts
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      options.onStatusChange?.(attempt === 1 ? 'uploading' : `retrying (${attempt}/${maxAttempts})`)
      
      const result = await uploadFunction(file, options.onProgress)
      return result
      
    } catch (err: any) {
      const uploadError = detectNetworkError(err)
      
      if (attempt < maxAttempts && isRetryableError(uploadError)) {
        const delay = calculateRetryDelay(attempt)
        
        options.onRetryAttempt?.(attempt + 1, delay)
        options.onStatusChange?.(`retrying in ${(delay / 1000).toFixed(1)}s`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // Final failure
      throw createFinalRetryError(uploadError, attempt)
    }
  }
}