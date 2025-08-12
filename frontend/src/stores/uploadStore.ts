import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// UploadPart interface removed - using presigned upload system

export interface UploadEntry {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'success' | 'error' | 'canceled'
  progress: number
  error?: string
  attempts: number
  maxAttempts: number
  
  // Presigned upload specific fields
  key?: string
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
  updateProgress: (id: string, progress: number) => void
  markSuccess: (id: string, moduleId: string) => void
  markError: (id: string, error: Error) => void
  cancelUpload: (id: string) => void
  retryUpload: (id: string) => void
  startUpload: (id: string) => void
  
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

      updateProgress: (id: string, progress: number) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            progress,
            totalProgress: progress
          })

          return { uploads: newUploads }
        })
      },

      startUpload: (id: string) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            status: 'uploading',
            startedAt: new Date()
          })

          const newActiveUploads = new Set(state.activeUploads)
          newActiveUploads.add(id)

          return { 
            uploads: newUploads,
            activeUploads: newActiveUploads
          }
        })
      },

      markSuccess: (id: string, moduleId: string) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            status: 'success',
            progress: 100,
            totalProgress: 100,
            moduleId,
            completedAt: new Date()
          })

          const newActiveUploads = new Set(state.activeUploads)
          newActiveUploads.delete(id)

          return { 
            uploads: newUploads,
            activeUploads: newActiveUploads
          }
        })
      },

      markError: (id: string, error: Error) => {
        set((state) => {
          const upload = state.uploads.get(id)
          if (!upload) return state

          const newUploads = new Map(state.uploads)
          newUploads.set(id, {
            ...upload,
            status: 'error',
            error: error.message,
            completedAt: new Date()
          })

          const newActiveUploads = new Set(state.activeUploads)
          newActiveUploads.delete(id)

          return { 
            uploads: newUploads,
            activeUploads: newActiveUploads
          }
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
