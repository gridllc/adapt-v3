import React, { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'

// Upload Manager Component
const UploadManager = () => {
  const [uploadStatus, setUploadStatus] = useState('idle') // idle, uploading, success, error
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const validateFile = (file: File) => {
    const validTypes = ['video/mp4', 'video/webm']
    const maxSize = 100 * 1024 * 1024 // 100MB
    
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please upload a valid video file (MP4 or WebM)')
      return false
    }
    
    if (file.size > maxSize) {
      setErrorMessage('File size must be less than 100MB')
      return false
    }
    
    return true
  }

  const handleFileUpload = async (file: File) => {
    if (!validateFile(file)) {
      setUploadStatus('error')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setFileName(file.name)
    setUploadStatus('uploading')
    setUploadProgress(0)
    setErrorMessage('')

    try {
      const response = await fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.UPLOAD), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadProgress(100)
      setUploadStatus('success')
      setModuleId(data.moduleId || '')
    } catch (error: any) {
      console.error('Upload error:', error)
      setErrorMessage(error.message || 'Upload failed. Please try again.')
      setUploadStatus('error')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const resetUpload = () => {
    setUploadStatus('idle')
    setUploadProgress(0)
    setFileName('')
    setModuleId('')
    setErrorMessage('')
  }

  return (
    <div className="space-y-6">
      {uploadStatus === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200 cursor-pointer group ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg'
              : 'border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 hover:shadow-md'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-6">
            <div className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-200 ${
              isDragActive 
                ? 'bg-blue-200 scale-110' 
                : 'bg-blue-100 group-hover:bg-blue-200 group-hover:scale-105'
            }`}>
              {isDragActive ? (
                <span className="text-3xl">📤</span>
              ) : (
                <span className="text-3xl">🎬</span>
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {isDragActive ? 'Drop your video here!' : 'Upload Training Video'}
              </h3>
              <p className="text-gray-600 mb-2">
                Drag & drop your video file here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports MP4 and WebM files up to 100MB • Recommended: 5-15 minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-10 text-center">
          <div className="space-y-6">
            <div className="w-16 h-16 mx-auto animate-spin text-blue-600 text-3xl flex items-center justify-center">⏳</div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Processing Upload</h3>
              <p className="text-gray-600 mb-4">Uploading {fileName}...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 font-medium">{uploadProgress}% complete</p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="bg-white border-2 border-green-200 rounded-2xl p-10 text-center">
          <div className="space-y-6">
            <div className="w-16 h-16 mx-auto text-green-600 text-3xl flex items-center justify-center bg-green-100 rounded-2xl">✅</div>
            <div>
              <h3 className="text-xl font-bold text-green-800 mb-3">Upload Successful!</h3>
              <p className="text-green-700 mb-6">
                <strong>{fileName}</strong> has been processed successfully. Your training module is ready!
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Upload Another
                </button>
                {moduleId && (
                  <button 
                    onClick={() => navigate(`/training/${moduleId}`)}
                    className="px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
                  >
                    <span>▶️</span>
                    Start Training
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="bg-white border-2 border-red-200 rounded-2xl p-10 text-center">
          <div className="space-y-6">
            <div className="w-16 h-16 mx-auto text-red-600 text-3xl flex items-center justify-center bg-red-100 rounded-2xl">⚠️</div>
            <div>
              <h3 className="text-xl font-bold text-red-800 mb-3">Upload Failed</h3>
              <p className="text-red-700 mb-6">
                {errorMessage || 'There was an error uploading your file. Please check the file format and try again.'}
              </p>
              <button
                onClick={resetUpload}
                className="px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
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

// Main Upload Page Component
export const UploadPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 transition-colors">
                  ← Dashboard
                </Link>
                <span className="text-gray-300">/</span>
                <span className="text-gray-500">Upload</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Upload Training Module</h1>
              <p className="mt-1 text-sm text-gray-500">
                Transform your video content into interactive AI-powered training experiences
              </p>
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Step 1 of 3
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Upload Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  🎬 Video Upload
                </h2>
              </div>
              <div className="p-6">
                <UploadManager />
              </div>
            </div>
          </div>

          {/* Sidebar - Process Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Process Steps */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📋 Process Steps
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Upload Video</h4>
                    <p className="text-sm text-gray-600">Choose your training video file</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-semibold text-sm mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-500">AI Processing</h4>
                    <p className="text-sm text-gray-400">Extract key steps and generate content</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-semibold text-sm mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-500">Review & Publish</h4>
                    <p className="text-sm text-gray-400">Edit steps and make it live</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips & Requirements */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  💡 Tips for Best Results
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-green-600">✅</span>
                  <p className="text-sm text-gray-700">
                    <strong>Clear audio:</strong> Speak clearly and minimize background noise
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-600">✅</span>
                  <p className="text-sm text-gray-700">
                    <strong>Good lighting:</strong> Ensure your actions are clearly visible
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-600">✅</span>
                  <p className="text-sm text-gray-700">
                    <strong>Step-by-step:</strong> Break down complex tasks into clear steps
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600">📏</span>
                  <p className="text-sm text-gray-700">
                    <strong>Duration:</strong> 5-15 minutes works best for engagement
                  </p>
                </div>
              </div>
            </div>

            {/* File Requirements */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  📎 File Requirements
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Formats:</span>
                  <span className="font-medium">MP4, WebM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Max size:</span>
                  <span className="font-medium">100 MB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Recommended:</span>
                  <span className="font-medium">1080p, 30fps</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">5-15 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 