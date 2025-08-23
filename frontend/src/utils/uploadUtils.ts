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
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Upload file with progress tracking
 */
export const uploadWithProgress = async (options: UploadOptions): Promise<Response> => {
  const { file, url, onProgress } = options
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    // Progress tracking
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

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
 * Upload file to S3 presigned URL with progress tracking (PUT method)
 */
export const uploadWithProgressS3 = async (options: {
  file: File
  url: string
  onProgress: (progress: number) => void
  timeout?: number
}): Promise<Response> => {
  const { file, url, onProgress, timeout = 60000 } = options
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    // Set up progress tracking
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    })

    // Set up completion handlers
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(new Response(xhr.response, { status: xhr.status }))
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out'))
    })

    // Configure request
    xhr.timeout = timeout
    xhr.open('PUT', url) // Use PUT for S3 presigned URLs

    // Send the file directly (not as FormData for S3)
    xhr.send(file)
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
