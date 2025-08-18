// frontend/src/components/upload/UploadManager.tsx
import React, { useState } from "react"
import { useUploadStore } from "../../stores/uploadStore"
import { uploadFileWithProgress } from "../../utils/uploadFileWithProgress"
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
            // request presigned URL from backend
            const res = await fetch("/api/upload/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, type: file.type }),
            })
            if (!res.ok) throw new Error("Failed to init upload")
            const { url, moduleId } = await res.json()

            // do actual upload
            await uploadFileWithProgress({
                file,
                url,
                onProgress: (pct) => updateProgress(uploadId, pct),
            })

            // notify backend processing
            await fetch("/api/upload/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId, filename: file.name }),
            })

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
