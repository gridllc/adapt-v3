import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UploadEntry {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'success' | 'error' | 'canceled'
  progress: number
  error?: string
  attempts: number
  moduleId?: string
  timestamp: number
}

interface UploadState {
  uploads: Record<string, UploadEntry>
  addUpload: (file: File) => string
  updateProgress: (id: string, progress: number) => void
  markSuccess: (id: string, moduleId: string) => void
  markError: (id: string, error: Error) => void
  retryUpload: (id: string) => void
  cancelUpload: (id: string) => void
  removeUpload: (id: string) => void
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set, get) => ({
      uploads: {},

      addUpload: (file: File) => {
        const id = crypto.randomUUID()
        const upload: UploadEntry = {
          id,
          file,
          status: 'queued',
          progress: 0,
          attempts: 0,
          timestamp: Date.now(),
        }

        set((state) => ({
          uploads: { ...state.uploads, [id]: upload },
        }))

        return id
      },

      updateProgress: (id: string, progress: number) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [id]: {
              ...state.uploads[id],
              progress,
              status: 'uploading',
            },
          },
        }))
      },

      markSuccess: (id: string, moduleId: string) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [id]: {
              ...state.uploads[id],
              status: 'success',
              progress: 100,
              moduleId,
            },
          },
        }))
      },

      markError: (id: string, error: Error) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [id]: {
              ...state.uploads[id],
              status: 'error',
              error: error.message,
              attempts: state.uploads[id].attempts + 1,
            },
          },
        }))
      },

      retryUpload: (id: string) => {
        const upload = get().uploads[id]
        if (upload && upload.status === 'error') {
          set((state) => ({
            uploads: {
              ...state.uploads,
              [id]: {
                ...upload,
                status: 'queued',
                progress: 0,
                error: undefined,
              },
            },
          }))
        }
      },

      cancelUpload: (id: string) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [id]: {
              ...state.uploads[id],
              status: 'canceled',
            },
          },
        }))
      },

      removeUpload: (id: string) => {
        set((state) => {
          const { [id]: removed, ...remaining } = state.uploads
          return { uploads: remaining }
        })
      },
    }),
    {
      name: 'upload-store',
      partialize: (state) => ({
        uploads: Object.fromEntries(
          Object.entries(state.uploads).filter(
            ([_, upload]) => upload.status === 'error' || upload.status === 'success'
          )
        ),
      }),
    }
  )
) 