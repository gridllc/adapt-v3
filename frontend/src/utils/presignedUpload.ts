export interface PresignedUploadResult {
  presignedUrl: string
  key: string
  fileUrl: string
}

export interface ProcessVideoResult {
  success: boolean
  moduleId: string
  videoUrl: string
  steps: any[]
  message?: string
}

export interface UploadProgressCallback {
  (percent: number): void
}

export interface UploadOptions {
  file: File
  onProgress: UploadProgressCallback
  signal?: AbortSignal
  authToken?: string
}

/**
 * Upload file directly to S3 using presigned URL
 */
export async function uploadWithPresignedUrl({
  file,
  onProgress,
  signal,
  authToken
}: UploadOptions): Promise<ProcessVideoResult> {
  try {
    // Step 1: Get presigned URL
    console.log('🔗 Requesting presigned URL for:', file.name)
    
    const presignedResponse = await fetch('/api/upload/presigned-url', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        fileSize: file.size
      }),
    })

    if (!presignedResponse.ok) {
      const errorData = await presignedResponse.json().catch(() => ({}))
      throw new Error(`Failed to get upload URL: ${presignedResponse.status} - ${errorData.error || 'Unknown error'}`)
    }

    const { presignedUrl, key, fileUrl }: PresignedUploadResult = 
      await presignedResponse.json()

    console.log('✅ Presigned URL received, uploading to S3...')

    // Step 2: Upload directly to S3
    await uploadToS3({
      file,
      presignedUrl,
      onProgress,
      signal,
    })

    console.log('✅ S3 upload complete, processing video...')

    // Step 3: Process video with AI
    const processResponse = await fetch('/api/upload/process', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify({
        videoUrl: fileUrl,
        key,
      }),
    })

    if (!processResponse.ok) {
      const errorData = await processResponse.json().catch(() => ({}))
      throw new Error(`Video processing failed: ${processResponse.status} - ${errorData.error || 'Unknown error'}`)
    }

    const result = await processResponse.json()
    console.log('✅ Video processing complete:', result)
    
    return result
  } catch (error) {
    console.error('❌ Presigned upload failed:', error)
    throw error
  }
}

/**
 * Upload file directly to S3 with progress tracking
 */
async function uploadToS3({
  file,
  presignedUrl,
  onProgress,
  signal,
}: {
  file: File
  presignedUrl: string
  onProgress: UploadProgressCallback
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Progress tracking
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    // Success handling
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`S3 upload failed: ${xhr.status} - ${xhr.statusText}`))
      }
    }

    // Error handling
    xhr.onerror = () => reject(new Error('Network error during S3 upload'))
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'))

    // Setup abort handling
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
      })
    }

    // Start upload
    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    
    // Add additional headers for better compatibility
    xhr.setRequestHeader('Cache-Control', 'no-cache')
    
    xhr.send(file)
  })
}

/**
 * Validate file before upload
 */
export function validateFileForUpload(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/wmv', 'video/flv']
  if (!validTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Unsupported file type. Please upload MP4, WebM, AVI, MOV, WMV, or FLV.' 
    }
  }

  // Check file size (200MB limit)
  const maxSize = 200 * 1024 * 1024
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'File too large. Please choose a file under 200MB.' 
    }
  }

  return { valid: true }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return "Unknown size"
  if (bytes === 0) return "0 B"
  
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const size = bytes / Math.pow(1024, exponent)
  
  return `${Math.round(size * 10) / 10} ${units[exponent]}`
}
