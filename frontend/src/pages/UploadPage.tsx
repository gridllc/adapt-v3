import React, { useState, useRef } from 'react'
import { Upload, Video, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

  console.log('UploadManager rendering, uploadStatus:', uploadStatus)
  
  return (
    <div className="space-y-4">
      {/* Debug: Test if Tailwind is working */}
      <div className="bg-red-500 text-white p-4 rounded">
        DEBUG: Upload Status = {uploadStatus} | Tailwind CSS Test
      </div>
      
      {uploadStatus === 'idle' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 scale-[1.02]'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              {isDragActive ? (
                <Upload className="w-8 h-8 text-blue-600" />
              ) : (
                <Video className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800 mb-2">
                {isDragActive ? 'Drop your video here' : 'Upload your training video'}
              </p>
              <p className="text-sm text-gray-500">
                Drag & drop your video file here, or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Supports MP4 and WebM files up to 100MB • Maximum 3 minutes
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-8 text-center">
          <div className="space-y-4">
            <Loader className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
            <div>
              <p className="text-lg font-semibold text-gray-800 mb-2">Uploading {fileName}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">{uploadProgress}% complete</p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="border-2 border-green-200 bg-green-50 rounded-xl p-8 text-center">
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-green-800 mb-2">Upload Complete!</p>
              <p className="text-sm text-green-600 mb-4">
                {fileName} has been processed successfully. Your training module is being generated.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={resetUpload}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Upload Another
                </button>
                {moduleId && (
                  <button 
                    onClick={() => navigate(`/training/${moduleId}`)}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    View Module
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="border-2 border-red-200 bg-red-50 rounded-xl p-8 text-center">
          <div className="space-y-4">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-red-800 mb-2">Upload Failed</p>
              <p className="text-sm text-red-600 mb-4">
                {errorMessage || 'There was an error uploading your file. Please try again.'}
              </p>
              <button
                onClick={resetUpload}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
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
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Upload Training Module v3
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Transform your video content into interactive training modules. 
          Our AI will automatically extract key steps and create engaging learning experiences.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Upload Video
          </h2>
          <p className="text-gray-600">
            Upload a video file to get started. The AI will analyze your content and generate a structured training module.
          </p>
        </div>
        
        <div className="p-8">
          <UploadManager />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">Easy Upload</h3>
          <p className="text-sm text-gray-600">
            Simply drag and drop your video files. We support MP4 and WebM formats.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">AI Processing</h3>
          <p className="text-sm text-gray-600">
            Our AI automatically extracts key learning points and creates structured modules.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-2">Interactive Learning</h3>
          <p className="text-sm text-gray-600">
            Generated modules include timestamped steps, AI chat assistance, and progress tracking.
          </p>
        </div>
      </div>
    </div>
  )
} 