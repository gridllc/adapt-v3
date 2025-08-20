export type UploadResult = { success: boolean; moduleId?: string; error?: string }

export async function uploadWithPresignedUrl({ file, onProgress }: { file: File; onProgress?: (p: number) => void }): Promise<UploadResult> {
  // 1) init → presigned PUT
  const initRes = await fetch(`/api/upload/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' })
  })
  if (!initRes.ok) return { success: false, error: `init ${initRes.status}` }
  const { success, moduleId, key, presignedUrl, error } = await initRes.json()
  if (!success || !moduleId || !presignedUrl) return { success: false, error: error || 'init failed' }

  // 2) PUT to S3 with progress
  await putWithProgress(presignedUrl, file, onProgress)

  // 3) complete
  const completeRes = await fetch(`/api/upload/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ moduleId, key })
  })
  if (!completeRes.ok) return { success: false, error: `complete ${completeRes.status}` }
  const done = await completeRes.json()
  if (!done.success) return { success: false, error: done.error || 'complete failed' }

  return { success: true, moduleId }
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