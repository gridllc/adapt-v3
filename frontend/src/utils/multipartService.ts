// frontend/src/utils/multipartService.ts

export interface MultipartUploadInit {
  key: string
  uploadId: string
  partSize: number
  partCount: number
}

export interface MultipartPart {
  partNumber: number
  etag: string
}

export interface MultipartUploadResult {
  success: boolean
  moduleId?: string
  videoUrl?: string
  key?: string
  etag?: string
  message?: string
}

const API_BASE = '/api/uploads/multipart'

/**
 * Initialize a new multipart upload
 */
export async function initializeUpload(
  filename: string,
  contentType: string,
  fileSize: number,
  isMobile: boolean = false
): Promise<MultipartUploadInit> {
  const response = await fetch(`${API_BASE}/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      filename,
      contentType,
      fileSize,
      isMobile
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to initialize upload' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const result = await response.json()
  return result
}

/**
 * Get a signed URL for uploading a specific part
 */
export async function getSignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const response = await fetch(`${API_BASE}/sign-part`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      key,
      uploadId,
      partNumber
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get signed URL' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const result = await response.json()
  return result.url
}

/**
 * Complete the multipart upload
 */
export async function completeUpload(
  key: string,
  uploadId: string,
  parts: MultipartPart[]
): Promise<MultipartUploadResult> {
  const response = await fetch(`${API_BASE}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      key,
      uploadId,
      parts
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to complete upload' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const result = await response.json()
  return result
}

/**
 * Abort the multipart upload
 */
export async function abortUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/abort`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      key,
      uploadId
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to abort upload' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
}

/**
 * Get authentication token from storage
 * This should be implemented based on your auth system
 */
function getAuthToken(): string {
  // TODO: Implement based on your authentication system
  // Examples:
  // - localStorage.getItem('authToken')
  // - sessionStorage.getItem('authToken')
  // - getToken() from auth context
  
  // For now, return empty string - you'll need to implement this
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || ''
}

/**
 * Check if the current environment supports multipart uploads
 */
export function isMultipartSupported(): boolean {
  // Check if File.slice is supported (required for chunking)
  if (!File.prototype.slice && !File.prototype.mozSlice && !File.prototype.webkitSlice) {
    return false
  }

  // Check if XMLHttpRequest supports upload progress
  if (!XMLHttpRequest.prototype.upload) {
    return false
  }

  // Check if fetch is supported
  if (typeof fetch === 'undefined') {
    return false
  }

  return true
}

/**
 * Get recommended part size for a given file size
 */
export function getRecommendedPartSize(fileSize: number, isMobile: boolean = false): number {
  const MIN_PART_SIZE = 5 * 1024 * 1024  // 5MB
  const MAX_PART_SIZE = 100 * 1024 * 1024 // 100MB

  if (isMobile) {
    // Mobile: smaller parts for better reliability
    return Math.max(MIN_PART_SIZE, 5 * 1024 * 1024) // 5MB
  } else {
    // Desktop: larger parts for better performance
    if (fileSize <= 100 * 1024 * 1024) { // Files under 100MB
      return Math.max(MIN_PART_SIZE, 8 * 1024 * 1024) // 8MB
    } else if (fileSize <= 1024 * 1024 * 1024) { // Files under 1GB
      return 16 * 1024 * 1024 // 16MB
    } else {
      return 32 * 1024 * 1024 // 32MB for larger files
    }
  }
}

/**
 * Calculate the number of parts for a given file size and part size
 */
export function calculatePartCount(fileSize: number, partSize: number): number {
  return Math.ceil(fileSize / partSize)
}

/**
 * Validate file for multipart upload
 */
export function validateFileForMultipart(
  file: File,
  options: {
    maxSize?: number // in bytes
    allowedTypes?: string[]
  } = {}
): { isValid: boolean; error?: string } {
  const { maxSize = 5 * 1024 * 1024 * 1024, allowedTypes = ['video/*'] } = options

  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
    }
  }

  // Check file type
  const isAllowedType = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const baseType = type.slice(0, -2)
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
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
