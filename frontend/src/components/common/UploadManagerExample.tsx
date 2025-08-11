import React, { useState } from 'react'
import { UploadManager, SimpleUploadManager, ManualUploadManager } from './UploadManager'
import { UploadErrorType } from '../../utils/uploadErrors'
import { uploadFileWithProgress, validateFileForUpload } from '../../utils/uploadFileWithProgress'

// 🎯 Real upload function using the upload helper
const realUpload = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<any> => {
  // 🎯 Validate file first
  const validation = validateFileForUpload(file, {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/*']
  })
  
  if (!validation.isValid) {
    throw {
      type: 'VALIDATION_ERROR',
      title: 'Invalid File',
      message: validation.error || 'File validation failed'
    }
  }
  
  // 🎯 Use the presigned upload helper
  return uploadFileWithProgress(file, onProgress || (() => {}), {
    url: '/api/upload/presigned-url',
    timeout: 60000,
    headers: {
      'X-Upload-Source': 'UploadManagerExample'
    }
  })
}

// 🎯 Example component showing different UploadManager usage patterns
export const UploadManagerExample: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'auto' | 'manual' | 'simple'>('auto')

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUploadSuccess = (response: any) => {
    console.log('✅ Upload success:', response)
    alert(`Upload successful! Module ID: ${response.moduleId}`)
  }

  const handleUploadError = (error: any) => {
    console.error('❌ Upload error:', error)
    alert(`Upload failed: ${error.message}`)
  }

  const handleUploadCancel = () => {
    console.log('⛔ Upload canceled')
    alert('Upload was canceled')
  }

  const renderUploadManager = () => {
    if (!selectedFile) return null

    switch (uploadMode) {
      case 'auto':
        return (
          <UploadManager
            file={selectedFile}
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
            onCancel={handleUploadCancel}
            performUpload={realUpload}
            maxAttempts={3}
            autoStart={true}
            className="mx-auto"
          />
        )
      
      case 'manual':
        return (
          <ManualUploadManager
            file={selectedFile}
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
            onCancel={handleUploadCancel}
            performUpload={realUpload}
            maxAttempts={3}
            onStart={() => console.log('🚀 Manual upload started')}
          />
        )
      
      case 'simple':
        return (
          <SimpleUploadManager
            file={selectedFile}
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
            onCancel={handleUploadCancel}
            performUpload={realUpload}
            maxAttempts={2}
            autoStart={true}
            className="mx-auto"
          />
        )
      
      default:
        return null
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">🧪 UploadManager Examples</h1>
        <p className="text-gray-600">Test different upload manager configurations</p>
      </div>

      {/* 🎯 File Selection */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">📁 File Selection</h2>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {selectedFile && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              <span className="font-medium">Selected:</span> {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          </div>
        )}
      </div>

      {/* 🎯 Upload Mode Selection */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">⚙️ Upload Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setUploadMode('auto')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              uploadMode === 'auto'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">🚀</div>
              <h3 className="font-semibold">Auto Start</h3>
              <p className="text-sm opacity-75">Starts immediately when file is selected</p>
            </div>
          </button>

          <button
            onClick={() => setUploadMode('manual')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              uploadMode === 'manual'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">👆</div>
              <h3 className="font-semibold">Manual Start</h3>
              <p className="text-sm opacity-75">Requires user to click start button</p>
            </div>
          </button>

          <button
            onClick={() => setUploadMode('simple')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              uploadMode === 'simple'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-semibold">Simple</h3>
              <p className="text-sm opacity-75">Streamlined version with fewer retries</p>
            </div>
          </button>
        </div>
      </div>

      {/* 🎯 Upload Manager Display */}
      {selectedFile && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            📤 Upload Manager ({uploadMode} mode)
          </h2>
          {renderUploadManager()}
        </div>
      )}

      {/* 🎯 Usage Instructions */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">📚 Usage Instructions</h2>
        <div className="space-y-3 text-sm text-blue-800">
          <div>
            <strong>Auto Mode:</strong> Upload starts immediately when file is selected. Best for quick uploads.
          </div>
          <div>
            <strong>Manual Mode:</strong> User must click "Start Upload" button. Good for when you want user control.
          </div>
          <div>
            <strong>Simple Mode:</strong> Streamlined version with fewer retry attempts. Good for testing.
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded">
            <strong>💡 Tip:</strong> The upload simulation has a 70% success rate to demonstrate retry behavior.
          </div>
        </div>
      </div>
    </div>
  )
}

// 🎯 Helper function for file size formatting
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default UploadManagerExample 