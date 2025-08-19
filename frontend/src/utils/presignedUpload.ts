import { apiClient } from '../config/api'

interface UploadResult {
  success: boolean
  moduleId?: string
  error?: string
}

export async function uploadWithPresignedUrl({
  file,
  onProgress,
}: {
  file: File
  onProgress?: (progress: number) => void
}): Promise<UploadResult> {
  try {
    // Step 1: Init → get presigned URL + moduleId
    const initRes = await apiClient.post('/upload/init', {
      filename: file.name,
    })
    if (!initRes.data.success) return initRes.data

    const { moduleId, presignedUrl } = initRes.data

    // Step 2: Upload file directly to S3
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presignedUrl, true)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100)
        }
      }
      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(new Error(`Upload failed ${xhr.status}`))
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })

    // Step 3: Tell backend upload is complete
    await apiClient.post('/upload/complete', { moduleId })

    return { success: true, moduleId }
  } catch (err: any) {
    console.error('❌ uploadWithPresignedUrl error:', err)
    return { success: false, error: err.message }
  }
}