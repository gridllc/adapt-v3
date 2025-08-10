import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface UploadPart {
  partNumber: number
  start: number
  end: number
  size: number
  etag?: string
  uploaded: boolean
  progress: number
  error?: string
}

export interface UploadEntry {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'success' | 'error' | 'canceled'
  progress: number
  error?: string
  attempts: number
  maxAttempts: number
  
  // Multipart upload specific fields
  key?: string
  uploadId?: string
  partSize?: number
  partCount?: number
  parts?: UploadPart[]
  totalProgress: number
  
  // Result fields
  moduleId?: string
  videoUrl?: string
  
  // Metadata
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

interface UploadState {
  uploads: Map<string, UploadEntry>
  activeUploads: Set<string>
  maxConcurrentUploads: number
  
  // Actions
  addUpload: (file: File) => string
  removeUpload: (id: string) => void
  updateUpload: (id: string, updates: Partial<UploadEntry>) => void
  updatePartProgress: (id: string, partNumber: number, progress: number) => void
  markPartComplete: (id: string, partNumber: number, etag: string) => void
  markPartError: (id: string, partNumber: number, error: string) => void
  cancelUpload: (id: string) => void
  retryUpload: (id: string) => void
  
  // Getters
  getUpload: (id: string) => UploadEntry | undefined
  getQueuedUploads: () => UploadEntry[]
  getActiveUploads: () => UploadEntry[]
  getCompletedUploads: () => UploadEntry[]
  getFailedUploads: () => UploadEntry[]
  
  // State management
  setMaxConcurrentUploads: (max: number) => void
  clearCompletedUploads: () => void
  clearAllUploads: () => void
}

export const useUploadStore = create<UploadState>()(
  devtools(
    (set, get) => ({
      uploads: new Map(),
      activeUploads: new Set(),
      maxConcurrentUploads: 3,

      addUpload: (file: File) => {
        const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        const upload: UploadEntry = {
          id,
          file,
          status: 'queued',
          progress: 0,
          attempts: 0,
          maxAttempts: 3,
          totalProgress: 0,
          createdAt: new Date(),
        }

        set((state) => {
          const newUploads = new Map(state.uploads)
          newUploads.set(id, upload)
          return { uploads: newUploads }
        })

        return id
      },

      removeUpload: (id: string) => {
        set((state) => {
          const newUploads = new Map(state.uploads)
          newUploads.delete(id)
          
          const newActiveUploads = new Set(state.activeUploads)
          newActiveUploads.delete(id)
          
          return { 
            uploads: newUploads,
            activeUploads: newActiveUploads
          }
        })
      },

      updateUpload: (id: string, updates: Partial<UploadEntry>) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const updatedUpload = { ...upload, ...updates }
          const newUploads = new Map(state.uploads)
          newUploads.set(id, updatedUpload)

          // Update active uploads set
          const newActiveUploads = new Set(state.activeUploads)
          if (updates.status === 'uploading') {
            newActiveUploads.add(id)
          } else if (updates.status === 'success' || updates.status === 'error' || updates.status === 'canceled') {
            newActiveUploads.delete(id)
          }

          return { 
            uploads: newUploads,
            activeUploads: newActiveUploads
          }
        })
      },

      updatePartProgress: (id: string, partNumber: number, progress: number) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload || !upload.parts) return state

          const updatedParts = upload.parts.map(part => 
            part.partNumber === partNumber 
              ? { ...part, progress }
              : part
          )

          // Calculate total progress
          const totalProgress = updatedParts.reduce((sum, part) => {
            return sum + (part.size * part.progress / 100)
          }, 0)

          const totalProgressPercent = Math.round((totalProgress / upload.file.size) * 100)

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            parts: updatedParts,
            progress: totalProgressPercent,
            totalProgress: totalProgressPercent
          })

          return { uploads: newUploads }
        })
      },

      markPartComplete: (id: string, partNumber: number, etag: string) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload || !upload.parts) return state

          const updatedParts = upload.parts.map(part => 
            part.partNumber === partNumber 
              ? { ...part, uploaded: true, etag, progress: 100, error: undefined }
              : part
          )

          // Check if all parts are complete
          const allPartsComplete = updatedParts.every(part => part.uploaded)
          const newStatus = allPartsComplete ? 'success' : upload.status

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            parts: updatedParts,
            status: newStatus,
            completedAt: newStatus === 'success' ? new Date() : upload.completedAt
          })

          return { uploads: newUploads }
        })
      },

      markPartError: (id: string, partNumber: number, error: string) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload || !upload.parts) return state

          const updatedParts = upload.parts.map(part => 
            part.partNumber === partNumber 
              ? { ...part, error, progress: 0 }
              : part
          )

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            parts: updatedParts,
            status: 'error',
            error: `Part ${partNumber} failed: ${error}`
          })

          return { uploads: newUploads }
        })
      },

      cancelUpload: (id: string) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            status: 'canceled',
            progress: 0
          })

          const newActiveUploads = new Set(state.activeUploads)
          newActiveUploads.delete(id)

          return { 
            uploads: newUploads,
            activeUploads: newActiveUploads
          }
        })
      },

      retryUpload: (id: string) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            status: 'queued',
            progress: 0,
            totalProgress: 0,
            error: undefined,
            attempts: upload.attempts + 1,
            startedAt: undefined,
            completedAt: undefined
          })

          return { uploads: newUploads }
        })
      },

      getUpload: (id: string) => {
        return get().uploads.get(id)
      },

      getQueuedUploads: () => {
        return Array.from(get().uploads.values()).filter(upload => upload.status === 'queued')
      },

      getActiveUploads: () => {
        return Array.from(get().uploads.values()).filter(upload => upload.status === 'uploading')
      },

      getCompletedUploads: () => {
        return Array.from(get().uploads.values()).filter(upload => upload.status === 'success')
      },

      getFailedUploads: () => {
        return Array.from(get().uploads.values()).filter(upload => upload.status === 'error')
      },

      setMaxConcurrentUploads: (max: number) => {
        set({ maxConcurrentUploads: max })
      },

      clearCompletedUploads: () => {
        set((state) => {
          const newUploads = new Map()
          state.uploads.forEach((upload, id) => {
            if (upload.status !== 'success') {
              newUploads.set(id, upload)
            }
          })
          return { uploads: newUploads }
        })
      },

      clearAllUploads: () => {
        set({ uploads: new Map(), activeUploads: new Set() })
      },
    }),
    {
      name: 'upload-store',
    }
  )
)
