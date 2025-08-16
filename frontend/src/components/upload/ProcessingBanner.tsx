// frontend/src/components/upload/ProcessingBanner.tsx
import React from "react"

interface ProcessingBannerProps {
    status: "idle" | "uploading" | "processing" | "ready" | "error"
    progress?: number
}

export const ProcessingBanner: React.FC<ProcessingBannerProps> = ({
    status,
    progress,
}) => {
    if (status === "idle") return null

    let message = ""
    switch (status) {
        case "uploading":
            message = `Uploading... ${progress ?? 0}%`
            break
        case "processing":
            message = "Processing your video..."
            break
        case "ready":
            message = "Ready!"
            break
        case "error":
            message = "Something went wrong during upload."
            break
    }

    return (
        <div className="p-4 bg-gray-100 border rounded-md text-center">
            <p className="text-gray-700">{message}</p>
        </div>
    )
}
