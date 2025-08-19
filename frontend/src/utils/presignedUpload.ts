// frontend/src/utils/presignedUpload.ts

export interface PresignedUploadInitResult {
  success: boolean
  moduleId: string
  presignedUrl: string
  s3Key: string
  stepsKey: string
  expiresIn: number
  maxFileSize: number
}

export interface UploadCompleteResult {
  success: boolean
  moduleId: string
  status: string
  message: string
}

export async function uploadWithPresignedUrl({
  file,
  onProgress,
  signal,
}: {
  file: File
  onProgress: (percent: number) => void
  signal?: AbortSignal
}): Promise<UploadCompleteResult> {
  console.log('🚀 [Presigned Upload] Starting upload for:', file.name)
  
  // Step 1: Initialize upload - get presigned URL and moduleId
  console.log('🔑 [Presigned Upload] Step 1: Getting presigned URL...')
  
  // Sanitize filename (engineer's good idea)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  console.log('🔧 [Presigned Upload] Sanitized filename:', { original: file.name, sanitized: safeName })
  
  const initResponse = await fetch('/api/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: safeName,
      contentType: file.type, // Required by backend validation
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for title
      fileSize: file.size // Include fileSize as engineer suggested
    }),
  })

  if (!initResponse.ok) {
    let errorMessage = 'Failed to initialize upload'
    try {
      const errorData = await initResponse.json()
      if (errorData.details && Array.isArray(errorData.details)) {
        const validationErrors = errorData.details.map((err: any) => `${err.field}: ${err.message}`).join(', ')
        errorMessage = `Validation failed: ${validationErrors}`
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Fallback to text if JSON parsing fails
      const errorText = await initResponse.text()
      errorMessage = errorText
    }
    
    console.error('❌ [Presigned Upload] Failed to initialize upload:', errorMessage)
    throw new Error(`[Presigned Upload] ${errorMessage}`)
  }

  const initResult: PresignedUploadInitResult = await initResponse.json()
  console.log('✅ [Presigned Upload] Got presigned URL:', { 
    moduleId: initResult.moduleId,
    s3Key: initResult.s3Key 
  })

  // Step 2: Upload directly to S3
  console.log('📤 [Presigned Upload] Step 2: Uploading to S3...')
  await uploadToS3({ 
    file, 
    presignedUrl: initResult.presignedUrl, 
    onProgress, 
    signal 
  })
  console.log('✅ [Presigned Upload] S3 upload complete')

  // Step 3: Notify backend that upload is complete
  console.log('📬 [Presigned Upload] Step 3: Notifying backend of completion...')
  const completeResponse = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: initResult.moduleId,
      s3Key: initResult.s3Key,
      filename: safeName, // Use sanitized name
      title: file.name.replace(/\.[^/.]+$/, '')
    }),
  })

  if (!completeResponse.ok) {
    let errorMessage = 'Failed to complete upload'
    try {
      const errorData = await completeResponse.json()
      if (errorData.details && Array.isArray(errorData.details)) {
        const validationErrors = errorData.details.map((err: any) => `${err.field}: ${err.message}`).join(', ')
        errorMessage = `Validation failed: ${validationErrors}`
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Fallback to text if JSON parsing fails
      const errorText = await completeResponse.text()
      errorMessage = errorText
    }
    
    console.error('❌ [Presigned Upload] Failed to complete upload:', errorMessage)
    throw new Error(`[Presigned Upload] ${errorMessage}`)
  }

  const completeResult: UploadCompleteResult = await completeResponse.json()
  console.log('✅ [Presigned Upload] Upload completed successfully:', completeResult)

  return completeResult
}

async function uploadToS3({
  file,
  presignedUrl,
  onProgress,
  signal,
}: {
  file: File
  presignedUrl: string
  onProgress: (percent: number) => void
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('S3 upload successful')
        resolve()
      } else {
        console.error('S3 upload failed with status:', xhr.status)
        reject(new Error(`S3 upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => {
      console.error('Network error during S3 upload')
      reject(new Error('Network error during S3 upload'))
    }
    
    xhr.onabort = () => {
      console.log('S3 upload cancelled')
      reject(new Error('Upload cancelled'))
    }

    signal?.addEventListener('abort', () => {
      console.log('Aborting S3 upload')
      xhr.abort()
    })

    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}