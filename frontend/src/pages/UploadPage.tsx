import React from 'react'
import { UploadManager } from '@components/upload/UploadManager'

export const UploadPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Upload Training Module</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upload Video
        </h2>
        <p className="text-gray-600 mb-6">
          Upload a video file (MP4 or WebM) that's 3 minutes or less. 
          The AI will automatically extract steps and create a training module.
        </p>
        
        <UploadManager />
      </div>
    </div>
  )
} 