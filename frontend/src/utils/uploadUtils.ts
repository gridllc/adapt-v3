// ✅ Final Production-Ready Upload Utilities

/**
 * Validates a file for upload requirements
 */
export async function validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // Check file type
  const validTypes = ['video/mp4', 'video/webm']
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Unsupported file type. Please upload MP4 or WebM.' }
  }

  // Check file size (100MB limit)
  const maxSize = 100 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large. Please choose a file under 100MB.' }
  }

  // Check video duration (3 minutes max)
  return await validateVideoDuration(file)
}

/**
 * Validates video duration using HTMLVideoElement
 */
async function validateVideoDuration(file: File): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = video.duration
      
      if (duration > 180) { // 3 minutes = 180 seconds
        resolve({ valid: false, error: 'Video too long. Please upload a video under 3 minutes.' })
      } else {
        resolve({ valid: true })
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ valid: false, error: 'Invalid video file. Please try another file.' })
    }

    video.src = url
  })
}

/**
 * Uploads a file using XMLHttpRequest with timeout, progress tracking,
 * cancellation, and FormData support.
 */
export async function uploadWithProgress({
  file,
  url,
  onProgress,
  timeout = 30000,
  signal,
}: {
  file: File
  url: string
  onProgress: (percent: number) => void
  timeout?: number
  signal?: AbortSignal
}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  const finalSignal = signal ?? controller.signal

  try {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", url)
      xhr.timeout = timeout

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response(xhr.response, { status: xhr.status }))
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error("Network error during upload"))
      xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"))
      xhr.ontimeout = () => reject(new Error("Upload timed out"))

      const formData = new FormData()
      formData.append("file", file)
      xhr.send(formData)

      finalSignal.addEventListener("abort", () => xhr.abort())
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Returns retry delay using exponential backoff with jitter and max cap.
 */
export function getNetworkRetryDelay(attempt: number): number {
  const connection = (navigator as any).connection
  const baseDelay = connection?.effectiveType === "4g" ? 1000 : 3000
  const jitter = Math.floor(Math.random() * 500)
  const delay = baseDelay * 2 ** attempt + jitter
  return Math.min(delay, 30000) // cap at 30s
}

/**
 * Categorizes errors and marks them as retryable or not.
 */
export function categorizeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { message: "Upload was cancelled.", retryable: true }
  }
  const msg = (error as any)?.message || ""
  const lowerMsg = msg.toLowerCase()

  // Network errors (retryable)
  if (lowerMsg.includes("network") || lowerMsg.includes("connection")) {
    return { message: "Network issue. Please check your connection.", retryable: true }
  }
  if (lowerMsg.includes("timeout")) {
    return { message: "Connection timed out. Please try again.", retryable: true }
  }

  // Validation errors (not retryable)
  if (lowerMsg.includes("file type") || lowerMsg.includes("unsupported")) {
    return { message: "Unsupported file type. Please upload MP4 or WebM.", retryable: false }
  }
  if (lowerMsg.includes("file size") || lowerMsg.includes("too large")) {
    return { message: "File too large. Please choose a smaller file.", retryable: false }
  }
  if (lowerMsg.includes("validation")) {
    return { message: "Invalid file. Please try another file.", retryable: false }
  }

  // Server errors (retryable)
  if (lowerMsg.includes("500") || lowerMsg.includes("server error")) {
    return { message: "Server error. Please try again later.", retryable: true }
  }
  if (lowerMsg.includes("503") || lowerMsg.includes("service unavailable")) {
    return { message: "Service temporarily unavailable. Please try again.", retryable: true }
  }

  // Client errors (not retryable)
  if (lowerMsg.includes("400") || lowerMsg.includes("bad request")) {
    return { message: "Invalid request. Please check your file.", retryable: false }
  }
  if (lowerMsg.includes("413") || lowerMsg.includes("payload too large")) {
    return { message: "File too large for server. Please choose a smaller file.", retryable: false }
  }
  if (lowerMsg.includes("403") || lowerMsg.includes("forbidden")) {
    return { message: "Upload not allowed. Please check your permissions.", retryable: false }
  }

  return { message: "Unexpected error during upload. Please try again.", retryable: true }
}

/**
 * Formats file sizes with edge case support and precision.
 */
export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return "Unknown size"
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const size = bytes / Math.pow(1024, exponent)
  return `${Math.round(size * 10) / 10} ${units[exponent]}`
} 