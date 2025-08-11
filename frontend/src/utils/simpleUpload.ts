// SOLUTION: Use your backend as a proxy - no CORS issues

// Response type from backend upload endpoint
interface UploadResponse {
  success: boolean
  moduleId: string
  videoUrl: string
  steps: any[]
}

export async function uploadWithBackendProxy({
  file,
  onProgress,
  signal,
}: {
  file: File
  onProgress: (percent: number) => void
  signal?: AbortSignal
}): Promise<UploadResponse> {
  console.log('Starting backend proxy upload for:', file.name)
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as UploadResponse
          resolve(result)
        } catch (e) {
          reject(new Error('Invalid response from server'))
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    signal?.addEventListener('abort', () => xhr.abort())

    // Use the existing /api/upload endpoint
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}
