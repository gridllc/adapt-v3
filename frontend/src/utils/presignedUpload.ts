export interface PresignedUploadResult {
  presignedUrl: string
  key: string
  fileUrl: string
}

export async function uploadWithPresignedUrl({
  file,
  onProgress,
  signal,
}: {
  file: File
  onProgress: (percent: number) => void
  signal?: AbortSignal
}) {
  // Step 1: Get presigned URL
  const presignedResponse = await fetch('/api/upload/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
    }),
  })

  if (!presignedResponse.ok) {
    const error = await presignedResponse.text()
    throw new Error(`Failed to get upload URL: ${error}`)
  }

  const { presignedUrl, key, fileUrl }: PresignedUploadResult = 
    await presignedResponse.json()

  // Step 2: Upload to S3
  await uploadToS3({ file, presignedUrl, onProgress, signal })

  // Step 3: Process video
  const processResponse = await fetch('/api/upload/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoUrl: fileUrl }),
  })

  if (!processResponse.ok) {
    throw new Error(`Video processing failed: ${processResponse.status}`)
  }

  return processResponse.json()
}

async function uploadToS3({
  file,
  presignedUrl,
  onProgress,
  signal,
}: {
  file: File
  presignedUrl: string
  onProgress: (percent: number) => void
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`S3 upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    signal?.addEventListener('abort', () => xhr.abort())

    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', file.type)
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
