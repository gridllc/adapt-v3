import React from 'react'
import { UploadEntry, useUploadStore } from '@stores/uploadStore'
import { CheckCircle, XCircle, Loader2, X, AlertCircle, RefreshCw } from 'lucide-react'

interface UploadItemProps {
  id: string
  upload: UploadEntry
  onCancel?: (id: string) => void
}

export const UploadItem: React.FC<UploadItemProps> = ({ id, upload, onCancel }) => {
  const { cancelUpload: storeCancelUpload, removeUpload, retryUpload } = useUploadStore()

  const handleCancel = () => {
    if (onCancel) {
      onCancel(id)
    } else {
      storeCancelUpload(id)
    }
  }

  const getStatusIcon = () => {
    switch (upload.phase) {
      case 'ready':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'uploading':
      case 'finalizing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'processing':
        return <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
      case 'idle':
        return <div className="w-5 h-5 rounded-full bg-gray-300" />
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-300" />
    }
  }

  const getStatusText = () => {
    switch (upload.phase) {
      case 'ready':
        return 'Upload complete'
      case 'error':
        return upload.error || 'Upload failed'
      case 'uploading':
        return `Uploading... ${upload.progress}%`
      case 'finalizing':
        return `Finalizing... ${upload.progress}%`
      case 'processing':
        return upload.moduleId ? 'Processing video...' : 'Preparing processing...'
      case 'idle':
        return upload.status === 'canceled' ? 'Upload canceled' : 'Queued for upload'
      default:
        return 'Unknown status'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getProgressBarColor = () => {
    switch (upload.phase) {
      case 'ready':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'uploading':
      case 'finalizing':
        return 'bg-blue-500'
      case 'processing':
        return 'bg-purple-500'
      case 'idle':
        return upload.status === 'canceled' ? 'bg-gray-400' : 'bg-gray-300'
      default:
        return 'bg-gray-300'
    }
  }

  const canCancel = upload.status === 'uploading' || upload.status === 'queued'
  const canRemove = upload.status === 'success' || upload.status === 'error' || upload.status === 'canceled'
  const canRetry = upload.status === 'error' && upload.attempts < upload.maxAttempts

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {upload.file.name}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(upload.file.size)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {canRetry && (
            <button
              onClick={() => retryUpload(id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Retry upload"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          )}
          
          {canCancel && (
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-gray-100 rounded"
              title="Cancel upload"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
          
          {canRemove && (
            <button
              onClick={() => removeUpload(id)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Remove from list"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {getStatusText()}
      </p>

      {/* Progress bar - show for uploading/finalizing phases */}
      {(upload.phase === 'uploading' || upload.phase === 'finalizing') && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${upload.progress}%` }}
          />
        </div>
      )}

      {/* Processing info */}
      {upload.phase === 'processing' && upload.moduleId && (
        <div className="text-xs text-gray-500 mb-3">
          Module ID: <span className="font-mono">{upload.moduleId}</span>
        </div>
      )}

      {/* Error details */}
      {upload.error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {upload.error}
        </div>
      )}
    </div>
  )
}
