import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_CONFIG, API_ENDPOINTS } from '../config/api'
import { VideoProcessingFeedback } from '../components/common/FeedbackWidget'
import { VideoCompressor } from '../utils/videoCompression'
import { ChunkedUploader, UploadProgress } from '../utils/chunkedUpload'

export const UploadPage: React.FC = () => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'compressing' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [originalFileSize, setOriginalFileSize] = useState(0)
  const [compressedFileSize, setCompressedFileSize] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

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
      // Step 1: Compress video
      console.log('🎬 Starting video compression...')
      console.log('📊 Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      const compressedFile = await VideoCompressor.compressVideo(file, {
        quality: 0.7,
        maxWidth: 1280,
        maxHeight: 720,
        targetBitrate: 1000 // 1 Mbps
      })
      
      setCompressedFileSize(compressedFile.size)
      const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1)
      console.log(`📊 Compression complete: ${compressionRatio}% reduction`)
      console.log(`📊 Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`)

      // Step 2: Upload using chunked uploader
      setUploadStatus('uploading')
      const newModuleId = generateModuleId()
      
      console.log('🚀 Starting chunked upload...')
      console.log(`📦 Compressed file size: ${compressedFile.size} bytes`)
      console.log(`📦 Chunk size: ${2 * 1024 * 1024} bytes (2MB)`)
      console.log(`📦 Expected chunks: ${Math.ceil(compressedFile.size / (2 * 1024 * 1024))}`)
      
      const uploadResult = await ChunkedUploader.uploadVideoInChunks(
        compressedFile,
        newModuleId,
        {
          chunkSize: 2 * 1024 * 1024, // 2MB chunks
          maxConcurrent: 3,
          retryAttempts: 3,
          retryDelay: 1000
        },
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage)
          console.log(`📤 Upload progress: ${progress.percentage.toFixed(1)}% (${progress.currentChunk}/${progress.totalChunks} chunks)`)
        }
      )

      setModuleId(uploadResult.moduleId)
      setUploadProgress(100)
      setUploadStatus('success')
      
      console.log('✅ Upload completed successfully')
      console.log(`📊 Upload stats:`)
      console.log(`   Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Compression ratio: ${compressionRatio}%`)
      console.log(`   Module ID: ${uploadResult.moduleId}`)

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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Upload Training Module</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Upload your video and let AI turn it into a fully interactive learning experience.
          <br />
          <span className="text-sm text-blue-600">✨ Now with smart compression and faster uploads!</span>
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
                  style={{ width: `${compressionProgress}%`