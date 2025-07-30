import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

export const UploadPage: React.FC = () => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleUpload = async (file: File) => {
    setUploadStatus('uploading')
    setUploadProgress(0)
    setFileName(file.name)
    setErrorMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.UPLOAD), {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')
      setUploadProgress(100)
      setModuleId(data.moduleId)
      setUploadStatus('success')
    } catch (err: any) {
      setUploadStatus('error')
      setErrorMessage(err.message || 'Upload failed')
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files[0])
  }

  const resetUpload = () => {
    setUploadStatus('idle')
    setUploadProgress(0)
    setFileName('')
    setModuleId('')
    setErrorMessage('')
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Upload Training Module</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Upload your video and let AI turn it into a fully interactive learning experience.
        </p>
      </div>

      {uploadStatus === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 scale-[1.02]'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <div className="space-y-4">
            <div className="text-5xl mb-4">🎬</div>
            <div>
              <p className="text-lg font-semibold text-gray-800 mb-2">
                {isDragActive ? 'Drop your video here!' : 'Click or drop a video file'}
              </p>
              <p className="text-sm text-gray-500">Supports MP4/WebM up to 100MB</p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto animate-spin text-blue-600 text-2xl flex items-center justify-center">⏳</div>
            <div>
              <p className="text-lg font-semibold text-blue-700 mb-3">Uploading {fileName}...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-blue-600">{uploadProgress}% complete</p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto text-green-600 text-2xl flex items-center justify-center">✅</div>
            <div>
              <p className="text-lg font-semibold text-green-800 mb-3">Upload Complete!</p>
              <p className="text-green-700 mb-4">
                Your training module has been processed successfully.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Upload Another
                </button>
                <button
                  onClick={() => navigate(`/training/${moduleId}`)}
                  className="px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <span>▶️</span>
                  View Module
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto text-red-600 text-2xl flex items-center justify-center">⚠️</div>
            <div>
              <p className="text-lg font-semibold text-red-800 mb-3">Upload Failed</p>
              <p className="text-red-600 mb-4">{errorMessage}</p>
              <button
                onClick={resetUpload}
                className="px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 