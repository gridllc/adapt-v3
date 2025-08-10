import React from 'react'
import { UploadEntry, useUploadStore } from '@stores/uploadStore'
import { CheckCircle, XCircle, Loader2, X, AlertCircle, RefreshCw } from 'lucide-react'

interface UploadItemProps {
  id: string
  upload: UploadEntry
}

export const UploadItem: React.FC<UploadItemProps> = ({ id, upload }) => {
  const { cancelUpload, removeUpload, retryUpload } = useUploadStore()

  const getStatusIcon = () => {
    switch (upload.status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'uploading':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'canceled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-300" />
    }
  }

  const getStatusText = () => {
    switch (upload.status) {
      case 'success':
        return 'Upload complete'
      case 'error':
        return upload.error || 'Upload failed'
      case 'uploading':
        return `Uploading... ${upload.progress}%`
      case 'canceled':
        return 'Upload canceled'
      case 'queued':
        return 'Queued for upload'
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
    switch (upload.status) {
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'uploading':
        return 'bg-blue-500'
      case 'canceled':
        return 'bg-gray-400'
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
              <RefreshCw className="w-4 h-4 text-blue-500" />
            </button>
          )}
          
          {canCancel && (
            <button
              onClick={() => cancelUpload(id)}
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

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${upload.progress}%` }}
          />
        </div>
      </div>

      {/* Status Text */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">{getStatusText()}</p>
        
        {upload.status === 'success' && upload.moduleId && (
          <a
            href={`/training/${upload.moduleId}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            View Training →
          </a>
        )}
        
        {upload.status === 'error' && upload.attempts > 0 && (
          <span className="text-xs text-gray-500">
            Attempt {upload.attempts}/{upload.maxAttempts}
          </span>
        )}
      </div>

      {/* Multipart Upload Details */}
      {upload.status === 'uploading' && upload.parts && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-700">Parts Progress</p>
            <span className="text-xs text-gray-500">
              {upload.parts.filter(p => p.uploaded).length}/{upload.parts.length} complete
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-1">
            {upload.parts.map((part) => (
              <div key={part.partNumber} className="text-center">
                <div className="w-full bg-gray-200 rounded-full h-1 mb-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-200 ${
                      part.uploaded ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${part.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">Part {part.partNumber}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Details */}
      {upload.status === 'error' && upload.error && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {upload.error}
          </p>
        </div>
      )}

      {/* Upload Metadata */}
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Started: {upload.startedAt ? new Date(upload.startedAt).toLocaleTimeString() : 'Pending'}</span>
          {upload.completedAt && (
            <span>Completed: {new Date(upload.completedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}
