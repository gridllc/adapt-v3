// frontend/src/components/upload/UploadManager.tsx
import React, { useState } from "react"
import { useUploadStore } from "../../stores/uploadStore"

import { useNavigate } from "react-router-dom"

export const UploadManager: React.FC = () => {
  const { addUpload, updateProgress, markSuccess, markError } = useUploadStore()
  const [isUploading, setIsUploading] = useState(false)
  const navigate = useNavigate()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    // add to store
    const uploadId = addUpload(file)

    try {
      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('file', file)

      // Upload file directly to backend
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `Upload failed with status ${res.status}`)
      }
      
      const result = await res.json()
      const { moduleId } = result

      // Update progress to 100% since upload is complete
      updateProgress(uploadId, 100)
      markSuccess(uploadId, moduleId)

      // redirect to training page once done
      navigate(`/training/${moduleId}`)
    } catch (err: any) {
      console.error("Upload failed:", err)
      markError(uploadId, err.message || "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow-md border">
      <h2 className="text-xl font-semibold mb-4">Upload Training Video</h2>

      <input
        type="file"
        accept="video/*"
        disabled={isUploading}
        onChange={handleFileChange}
        className="mb-4"
      />

      {isUploading && (
        <p className="text-sm text-gray-600">Uploading... please wait</p>
      )}
    </div>
  )
}
