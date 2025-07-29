import React from 'react'
import { formatFileSize } from '@utils/uploadUtils'
import { useUploadStore } from '@stores/uploadStore'

interface UploadItemProps {
  id: string
  upload: any // Will be properly typed in uploadStore
}

export const UploadItem: React.FC<UploadItemProps> = ({ id, upload }) => {
  const { retryUpload, cancelUpload } = useUploadStore()

  const getStatusColor = () => {
    switch (upload.status) {
      case 'uploading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = () => {
    switch (upload.status) {
      case 'uploading':
        return 'Uploading...'
      case 'success':
        return 'Complete'
      case 'error':
        return 'Failed'
      default:
        return 'Queued'
    }
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <div className="text-lg">📹</div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{upload.file.name}</p>
              <p className="text-sm text-gray-500">
                {formatFileSize(upload.file.size)}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          {upload.status === 'uploading' && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {upload.progress}% complete
              </p>
            </div>
          )}
          
          {/* Error Message */}
          {upload.status === 'error' && upload.error && (
            <p className="text-sm text-red-600 mt-2">{upload.error}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          
          {upload.status === 'error' && (
            <button
              onClick={() => retryUpload(id)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Retry
            </button>
          )}
          
          {upload.status === 'uploading' && (
            <button
              onClick={() => cancelUpload(id)}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 