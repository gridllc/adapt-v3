// frontend/src/utils/uploadClient.ts

import axios from "axios"

export interface UploadResult {
  moduleId: string
}

/**
 * Ask backend for a presigned upload URL
 */
async function getSignedUrl(file: File): Promise<{ uploadUrl: string; moduleId: string }> {
  const res = await axios.post("/api/upload-url", {
    filename: file.name,
    type: file.type,
    size: file.size,
  })
  return res.data
}

/**
 * Upload file directly to S3 using presigned URL
 */
async function putToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        const pct = Math.round((evt.loaded * 100) / evt.total)
        onProgress(pct)
      }
    },
  })
}

/**
 * Tell backend upload is complete so it can start processing
 */
async function notifyComplete(moduleId: string): Promise<UploadResult> {
  const res = await axios.post(`/api/uploads/${moduleId}/complete`)
  return res.data
}

/**
 * Main upload flow: get signed URL → put to S3 → notify backend
 */
export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const { uploadUrl, moduleId } = await getSignedUrl(file)
  await putToS3(uploadUrl, file, onProgress)
  return await notifyComplete(moduleId)
}
