import { api, API_BASE } from '../config/api'

export type UploadResult = { success: boolean; moduleId?: string; error?: string }

interface InitResponse {
  success: boolean
  moduleId?: string
  key?: string
  presignedUrl?: string
  error?: string
}

interface CompleteResponse {
  success: boolean
  error?: string
}

export async function uploadWithPresignedUrl({ file, onProgress }: { file: File; onProgress?: (p: number) => void }): Promise<UploadResult> {
  try {
    // 1) init → presigned PUT (NOTE: use api.post or API_BASE)
    const init = await api.post<InitResponse>('/api/upload/init', {
      filename: file.name,
      contentType: file.type || 'video/mp4',
      sizeBytes: file.size,     // optional, for server validation later
    })
    
    if (!init?.success || !init.presignedUrl || !init.moduleId || !init.key) {
      return { success: false, error: init?.error || 'init failed' }
    }

    // 2) PUT to S3 with progress
    await putWithProgress(init.presignedUrl, file, onProgress)

    // 3) complete
    const done = await api.post<CompleteResponse>('/api/upload/complete', {
      moduleId: init.moduleId,
      key: init.key,
    })
    
    if (!done?.success) return { success: false, error: done?.error || 'complete failed' }
    return { success: true, moduleId: init.moduleId }
  } catch (error) {
    console.error('Upload error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' }
  }
}

async function putWithProgress(url: string, file: File, onProgress?: (p: number) => void) {
  if (!onProgress) {
    await fetch(url, { method: 'PUT', body: file })
    return
  }
  // XHR for progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('PUT failed'))
    xhr.send(file)
  })
}