// CREATE: frontend/src/utils/presignedUpload.ts

export interface PresignedUploadResult {
  presignedUrl: string
  key: string
  fileUrl: string
  expiresIn: number
  maxFileSize: number
}

export async function uploadWithPresignedUrl({
  file,
  onProgress,
  signal,
}: {
  file: File
  onProgress: (percent: number) => void
  signal?: AbortSignal
}) {
  console.log('Starting presigned upload for:', file.name)
  
  // Step 1: Get presigned URL
  const presignedResponse = await fetch('/api/upload/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
    }),
  })

  if (!presignedResponse.ok) {
    const errorText = await presignedResponse.text()
    console.error('Failed to get presigned URL:', errorText)
    throw new Error(`Failed to get upload URL: ${errorText}`)
  }

  const { presignedUrl, key, fileUrl }: PresignedUploadResult = 
    await presignedResponse.json()

  console.log('Got presigned URL, uploading to S3...')

  // Step 2: Upload directly to S3
  await uploadToS3({ file, presignedUrl, onProgress, signal })

  console.log('S3 upload complete, processing video...')

  // Step 3: Process video with AI
  const processResponse = await fetch('/api/upload/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoUrl: fileUrl }),
  })

  if (!processResponse.ok) {
    const errorText = await processResponse.text()
    console.error('Video processing failed:', errorText)
    throw new Error(`Video processing failed: ${errorText}`)
  }

  return processResponse.json()
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