import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'
import { VideoProcessingFeedback } from '../components/common/FeedbackWidget'
import { VideoCompressor } from '../utils/videoCompression'

export const UploadPage: React.FC = () => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'compressing' | 'uploading' | 'processing' | 'success' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [originalFileSize, setOriginalFileSize] = useState(0)
  const [compressedFileSize, setCompressedFileSize] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // AI Processing Progress Simulation
  useEffect(() => {
    if (uploadStatus === 'processing') {
      setProcessingProgress(0)
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 95) return prev
          return prev + Math.random() * 3 + 2 // Random increment between 2-5%
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [uploadStatus])

  // Fun messages based on progress
  const getProcessingMessage = (percent: number) => {
    if (percent < 20) return 'Analyzing video structure...'
    if (percent < 40) return 'Transcribing audio content...'
    if (percent < 60) return 'Extracting key moments...'
    if (percent < 80) return 'Teaching the AI...'
    if (percent < 95) return 'Almost there...'
    return 'Finalizing your training module...'
  }

  const generateModuleId = () => {
    return `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const handleUpload = async (file: File) => {
    setUploadStatus('compressing')
    setUploadProgress(0)
    setFileName(file.name)
    setErrorMessage('')
    setOriginalFileSize(file.size)

    try {
      // Check for empty file
      if (file.size === 0) {
        setErrorMessage('File appears to be empty. Please upload a valid video file.')
        setUploadStatus('error')
        return
      }

      // Step 1: Compress video
      console.log('🎬 Starting video compression...')
      console.log('📊 Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      
      let compressedFile: File
      try {
        compressedFile = await VideoCompressor.compressVideo(file, {
          quality: 0.7,
          maxWidth: 1280,
          maxHeight: 720,
          targetBitrate: 1000 // 1 Mbps
        })
      } catch (compressionError) {
        console.warn('⚠️ Compression failed, using original file:', compressionError)
        compressedFile = file
      }
      
      setCompressedFileSize(compressedFile.size)
      const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1)
      console.log(`📊 Compression complete: ${compressionRatio}% reduction`)
      console.log(`📊 Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`)

      // Check compressed file size
      if (compressedFile.size === 0) {
        setErrorMessage('Video compression failed - resulting file is empty. Please try a different video.')
        setUploadStatus('error')
        return
      }

      // Step 2: Upload using simple FormData
      setUploadStatus('uploading')
      const newModuleId = generateModuleId()
      
      console.log('🚀 Starting simple upload...')
      console.log(`📦 Compressed file size: ${compressedFile.size} bytes`)
      
      // Create FormData and upload
      const formData = new FormData()
      formData.append('file', compressedFile)
      
      const response = await fetch(API_CONFIG.getApiUrl(API_ENDPOINTS.UPLOAD), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      setModuleId(result.moduleId)
      setUploadProgress(100)
      
      // Start AI processing phase
      setUploadStatus('processing')
      console.log('✅ Upload completed successfully, starting AI processing...')
      console.log(`📊 Upload stats:`)
      console.log(`   Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Compression ratio: ${compressionRatio}%`)
      console.log(`   Module ID: ${result.moduleId}`)
      
      // Simulate AI processing completion after 5-8 seconds
      setTimeout(() => {
        setProcessingProgress(100)
        setUploadStatus('success')
      }, 5000 + Math.random() * 3000)

    } catch (err: any) {
      setUploadStatus('error')
      setErrorMessage(err.message || 'Upload failed')
      console.error('❌ Upload error:', err)
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
    setCompressionProgress(0)
    setOriginalFileSize(0)
    setCompressedFileSize(0)
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Uploading Training Module</h1>
        
        {/* Prominent AI Processing Message */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="text-3xl animate-pulse">⏳</div>
            <h2 className="text-xl font-bold text-blue-800">AI Processing in Progress</h2>
          </div>
          <p className="text-lg text-blue-700 font-medium">
            Give it a sec… your AI is being born. It can take up to 2 minutes to grow a brain.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-600">
            <span className="animate-spin">🔄</span>
            <span>Processing video, transcribing audio, and generating training steps...</span>
          </div>
        </div>
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
              <p className="text-xs text-blue-600 mt-2">🚀 Videos are automatically compressed for faster uploads</p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'compressing' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto animate-spin text-blue-600 text-2xl flex items-center justify-center">🎬</div>
            <div>
              <p className="text-lg font-semibold text-blue-700 mb-3">Compressing {fileName}...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${compressionProgress}%` }}
                />
              </div>
              <p className="text-sm text-blue-600">
                Original: {formatFileSize(originalFileSize)} → Compressing...
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto animate-spin text-green-600 text-2xl flex items-center justify-center">📤</div>
            <div>
              <p className="text-lg font-semibold text-green-700 mb-3">Uploading {fileName}...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-green-600">
                Compressed: {formatFileSize(compressedFileSize)} • {uploadProgress.toFixed(1)}% complete
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'processing' && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto animate-pulse text-indigo-600 text-2xl flex items-center justify-center">🧠</div>
            <div>
              <p className="text-lg font-semibold text-indigo-700 mb-3">AI Processing in Progress</p>
              <p className="text-sm text-indigo-600 mb-4">
                Give it a sec... your AI is being born. It can take up to 2 minutes to grow a brain.
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <p className="text-xs text-indigo-600">
                {getProcessingMessage(processingProgress)} • {processingProgress.toFixed(1)}% complete
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="text-5xl mb-4">🎉</div>
            <div>
              <h3 className="text-xl font-bold text-green-800 mb-2">Upload Successful!</h3>
              <p className="text-green-600 mb-4">
                Your video has been processed and is ready for training.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm text-green-700 mb-6">
                <div>
                  <span className="font-medium">Original:</span> {formatFileSize(originalFileSize)}
                </div>
                <div>
                  <span className="font-medium">Compressed:</span> {formatFileSize(compressedFileSize)}
                </div>
              </div>
              <div className="space-x-4">
                <button
                  onClick={() => navigate(`/training/${moduleId}`)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Start Training
                </button>
                <button
                  onClick={resetUpload}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Upload Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <div className="space-y-4">
            <div className="text-5xl mb-4">⚠️</div>
            <div>
              <h3 className="text-xl font-bold text-red-800 mb-2">Upload Failed</h3>
              <p className="text-red-600 mb-4">{errorMessage}</p>
              <button
                onClick={resetUpload}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Requirements */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 File Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">Supported Formats</h4>
            <ul className="space-y-1">
              <li>• MP4 (H.264 codec)</li>
              <li>• WebM (VP8/VP9 codec)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-2">Size Limits</h4>
            <ul className="space-y-1">
              <li>• Maximum file size: 100MB</li>
              <li>• Maximum duration: 3 minutes</li>
              <li>• Recommended: Clear audio</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}