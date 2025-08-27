import React, { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Fallback for older browsers that don't support crypto.randomUUID()
const genId = () =>
  (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

type UploadItem = {
  id: string
  name: string
  size: number
  progress: number
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'canceled'
  error?: string
  moduleId?: string
}

const api = (path: string, init?: RequestInit) =>
  fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })

const human = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${units[i]}`
}

const UploadManager: React.FC = () => {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const aborters = useRef<Record<string, AbortController>>({})
  const navigate = useNavigate()

  const update = (id: string, patch: Partial<UploadItem>) =>
    setUploads(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)))

  const addUpload = (file: File) => {
    const id = genId()
    const item: UploadItem = {
      id,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'idle',
    }
    setUploads(prev => [item, ...prev])
    return id
  }

  const putToS3 = async (url: string, file: File, id: string) => {
    const controller = new AbortController()
    aborters.current[id] = controller

    // Heuristic progress (fetch PUT lacks real progress)
    const started = Date.now()
    const progTimer = setInterval(() => {
      setUploads(prev => prev.map(u => {
        if (u.id !== id || u.status !== 'uploading') return u
        const sec = Math.max(0.5, (Date.now() - started) / 1000)
        const kbps = Math.round(file.size / 1024 / sec)
        const estPct = Math.min(99, Math.round((sec * kbps * 1024 * 100) / file.size))
        return { ...u, progress: estPct }
      }))
    }, 500)

    try {
      const res = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        signal: controller.signal,
      })
      clearInterval(progTimer)
      if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${res.statusText}`)
      update(id, { progress: 100 })
    } catch (e: any) {
      clearInterval(progTimer)
      if (controller.signal.aborted) throw new Error('canceled')
      throw e
    } finally {
      delete aborters.current[id]
    }
  }

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/')) {
        const id = addUpload(file)
        update(id, { status: 'error', error: 'Only video files are allowed' })
        continue
      }

      const id = addUpload(file)
      try {
        update(id, { status: 'uploading', progress: 5 })

        // 1) presign
        const presignRes = await api('/api/presigned-upload/presigned-url', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' }),
        })
        if (!presignRes.ok) throw new Error(`presign failed: ${presignRes.status}`)
        const { uploadUrl: presignedUrl, key, moduleId } = await presignRes.json()
        if (!presignedUrl || !key || !moduleId) throw new Error('presign missing fields')

        // 2) PUT file to S3
        await putToS3(presignedUrl, file, id)

        // 3) notify backend
        update(id, { status: 'processing' })
        const complete = await api('/api/upload/complete', {
          method: 'POST',
          body: JSON.stringify({ moduleId, key }),
        })
        if (!complete.ok) throw new Error(`complete failed: ${complete.status}`)
        update(id, { status: 'done', moduleId })

        // Jump to the training page (processing=true so UI shows the processing screen)
        navigate(`/training/${moduleId}?processing=true`)
        break // one-at-a-time UX
      } catch (err: any) {
        const msg = err?.message || 'Upload failed'
        update(id, { status: msg === 'canceled' ? 'canceled' : 'error', error: msg })
      }
    }
  }, [navigate])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()

  const cancel = (id: string) => {
    aborters.current[id]?.abort()
  }

  return (
    <div className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="border-2 border-dashed rounded-2xl p-10 text-center bg-gray-50 hover:bg-gray-100"
      >
        <p className="text-lg font-medium">Drag & drop a video here</p>
        <p className="text-sm text-gray-500 mb-4">MP4 recommended • Max a few hundred MB</p>
        <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
          Select video
          <input type="file" accept="video/*" onChange={onInputChange} hidden />
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-3">
          {uploads.map(u => (
            <div key={u.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-gray-500">{human(u.size)}</div>
                </div>
                <div className="text-sm">
                  {u.status === 'uploading' && <span className="text-blue-600">Uploading… {u.progress}%</span>}
                  {u.status === 'processing' && <span className="text-purple-600">Processing…</span>}
                  {u.status === 'done' && <span className="text-green-600">Done</span>}
                  {u.status === 'error' && <span className="text-red-600">Error</span>}
                  {u.status === 'canceled' && <span className="text-gray-500">Canceled</span>}
                </div>
              </div>

              <div className="mt-3 w-full h-2 bg-gray-200 rounded">
                <div
                  className="h-2 bg-blue-600 rounded transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>

              {(u.status === 'uploading' || u.status === 'processing') && (
                <div className="mt-3 flex gap-2">
                  {u.status === 'uploading' && (
                    <button
                      onClick={() => cancel(u.id)}
                      className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {u.error && <div className="mt-2 text-sm text-red-600">{u.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Support both default and named imports for compatibility
export default UploadManager
export { UploadManager }
