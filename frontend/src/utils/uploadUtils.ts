// Upload utilities for the frontend
// Simple, working upload system without complex dependencies

export interface UploadResponse {
  success: boolean
  moduleId: string
  videoUrl: string
  steps: Array<{
    id: number
    timestamp: number
    title: string
    description: string
    duration: number
  }>
}

export interface UploadOptions {
  file: File
  url: string
  onProgress: (progress: number) => void
  onPhaseChange?: (phase: 'uploading' | 'finalizing' | 'processing') => void
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Upload file with progress tracking
 */
export const uploadWithProgress = async (options: UploadOptions): Promise<Response> => {
  const { file, url, onProgress, onPhaseChange } = options
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    // (A) Show uploading immediately
    onPhaseChange?.('uploading')

    // Progress tracking
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
        
        // (B) Switch to finalizing near the end
        if (percent >= 95) {
          onPhaseChange?.('finalizing')
        }
      }
    }

    // Don't change to processing until upload actually completes
    // The UploadManager will handle the processing phase change

    // Success
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Create a Response object that mimics fetch
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers({
            'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json'
          })
        })
        resolve(response)
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    // Error handling
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    // Start upload
    xhr.open('POST', url)
    xhr.send(formData)
  })
}

/**
 * Validate file before upload
 */
export const validateFile = async (file: File): Promise<ValidationResult> => {
  // Check file type
  if (!file.type.startsWith('video/')) {
    return {
      valid: false,
      error: 'Only video files are allowed'
    }
  }

  // Check file size (200MB limit)
  const maxSize = 200 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds 200MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`
    }
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    }
  }

  return { valid: true }
}
