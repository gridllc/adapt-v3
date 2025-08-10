// frontend/src/utils/multipartUpload.ts
import { multipartService } from './multipartService'

export interface MultipartUploadConfig {
  maxConcurrent?: number
  maxRetries?: number
  retryDelay?: number
  onProgress?: (progress: number, loaded: number, total: number) => void
  onPartProgress?: (partNumber: number, progress: number) => void
  signal?: AbortSignal
}

export interface MultipartUploadState {
  uploadId: string
  key: string
  partSize: number
  partCount: number
  completedParts: Map<number, string> // partNumber -> etag
  failedParts: Set<number>
  currentPart: number
  isComplete: boolean
  error?: string
}

export interface MultipartUploadResult {
  success: boolean
  moduleId?: string
  videoUrl?: string
  key?: string
  etag?: string
  error?: string
}

export class MultipartUploadManager {
  private state: MultipartUploadState
  private config: Required<MultipartUploadConfig>
  private abortController: AbortController
  private activeUploads: Set<Promise<void>>
  private retryCounts: Map<number, number>

  constructor(
    private file: File,
    private filename: string,
    private contentType: string,
    config: MultipartUploadConfig = {}
  ) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 4,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      onProgress: config.onProgress || (() => {}),
      onPartProgress: config.onPartProgress || (() => {}),
      signal: config.signal
    }

    this.abortController = new AbortController()
    this.activeUploads = new Set()
    this.retryCounts = new Map()

    // Initialize state
    this.state = {
      uploadId: '',
      key: '',
      partSize: 0,
      partCount: 0,
      completedParts: new Map(),
      failedParts: new Set(),
      currentPart: 0,
      isComplete: false
    }

    // Handle external abort signal
    if (this.config.signal) {
      this.config.signal.addEventListener('abort', () => {
        this.abortController.abort()
      })
    }
  }

  /**
   * Initialize the multipart upload
   */
  async initialize(): Promise<void> {
    try {
      // Detect mobile device
      const isMobile = this.detectMobileDevice()
      
      const result = await multipartService.initializeUpload(
        this.filename,
        this.contentType,
        this.file.size,
        isMobile
      )

      this.state = {
        ...this.state,
        uploadId: result.uploadId,
        key: result.key,
        partSize: result.partSize,
        partCount: result.partCount
      }

      // Save to localStorage for resume capability
      this.saveResumeState()
    } catch (error) {
      throw new Error(`Failed to initialize upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Start the multipart upload process
   */
  async start(): Promise<MultipartUploadResult> {
    try {
      if (!this.state.uploadId) {
        await this.initialize()
      }

      // Check for resume state
      await this.loadResumeState()

      // Start uploading parts
      await this.uploadAllParts()

      // Complete the upload
      return await this.completeUpload()
    } catch (error) {
      if (this.abortController.signal.aborted) {
        throw new Error('Upload was cancelled')
      }
      
      // Try to abort the upload on S3
      try {
        if (this.state.uploadId) {
          await multipartService.abortUpload(this.state.key, this.state.uploadId)
        }
      } catch (abortError) {
        console.warn('Failed to abort upload on S3:', abortError)
      }

      throw error
    }
  }

  /**
   * Upload all parts with concurrency control
   */
  private async uploadAllParts(): Promise<void> {
    const parts = Array.from({ length: this.state.partCount }, (_, i) => i + 1)
    
    while (parts.length > 0 || this.activeUploads.size > 0) {
      // Start new uploads up to maxConcurrent
      while (parts.length > 0 && this.activeUploads.size < this.config.maxConcurrent) {
        const partNumber = parts.shift()!
        if (!this.state.completedParts.has(partNumber) && !this.state.failedParts.has(partNumber)) {
          const uploadPromise = this.uploadPart(partNumber)
          this.activeUploads.add(uploadPromise)
          
          uploadPromise.finally(() => {
            this.activeUploads.delete(uploadPromise)
          })
        }
      }

      // Wait for at least one upload to complete
      if (this.activeUploads.size > 0) {
        await Promise.race(this.activeUploads)
      }

      // Check for abort
      if (this.abortController.signal.aborted) {
        throw new Error('Upload was cancelled')
      }
    }
  }

  /**
   * Upload a single part
   */
  private async uploadPart(partNumber: number): Promise<void> {
    let retryCount = 0
    
    while (retryCount <= this.config.maxRetries) {
      try {
        // Get signed URL for this part
        const signedUrl = await multipartService.getSignedPartUrl(
          this.state.key,
          this.state.uploadId,
          partNumber
        )

        // Calculate part boundaries
        const start = (partNumber - 1) * this.state.partSize
        const end = Math.min(start + this.state.partSize, this.file.size)
        const partBlob = this.file.slice(start, end)

        // Upload the part
        const etag = await this.uploadPartToS3(signedUrl, partBlob, partNumber)

        // Mark as completed
        this.state.completedParts.set(partNumber, etag)
        this.state.failedParts.delete(partNumber)
        
        // Update progress
        this.updateProgress()
        this.saveResumeState()

        return
      } catch (error) {
        retryCount++
        console.warn(`Part ${partNumber} upload failed (attempt ${retryCount}):`, error)

        if (retryCount > this.config.maxRetries) {
          this.state.failedParts.add(partNumber)
          throw new Error(`Part ${partNumber} failed after ${retryCount} attempts`)
        }

        // Wait before retry with exponential backoff
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount - 1))
      }
    }
  }

  /**
   * Upload a part directly to S3 using the signed URL
   */
  private async uploadPartToS3(
    signedUrl: string, 
    partBlob: Blob, 
    partNumber: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          this.config.onPartProgress(partNumber, progress)
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          // Extract ETag from response headers
          const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, '')
          if (etag) {
            resolve(etag)
          } else {
            reject(new Error('No ETag received from S3'))
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.ontimeout = () => reject(new Error('Upload timeout'))

      xhr.open('PUT', signedUrl)
      xhr.timeout = 30000 // 30 second timeout
      xhr.send(partBlob)
    })
  }

  /**
   * Complete the multipart upload
   */
  private async completeUpload(): Promise<MultipartUploadResult> {
    try {
      // Convert completed parts to the format expected by the API
      const parts = Array.from(this.state.completedParts.entries()).map(([partNumber, etag]) => ({
        partNumber,
        etag
      }))

      const result = await multipartService.completeUpload(
        this.state.key,
        this.state.uploadId,
        parts
      )

      this.state.isComplete = true
      this.saveResumeState()

      return {
        success: true,
        moduleId: result.moduleId,
        videoUrl: result.videoUrl,
        key: result.key,
        etag: result.etag
      }
    } catch (error) {
      throw new Error(`Failed to complete upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update overall progress
   */
  private updateProgress(): void {
    const completedSize = Array.from(this.state.completedParts.keys()).reduce((total, partNumber) => {
      const start = (partNumber - 1) * this.state.partSize
      const end = Math.min(start + this.state.partSize, this.file.size)
      return total + (end - start)
    }, 0)

    const progress = (completedSize / this.file.size) * 100
    this.config.onProgress(progress, completedSize, this.file.size)
  }

  /**
   * Save resume state to localStorage
   */
  private saveResumeState(): void {
    const resumeData = {
      uploadId: this.state.uploadId,
      key: this.state.key,
      partSize: this.state.partSize,
      partCount: this.state.partCount,
      completedParts: Array.from(this.state.completedParts.entries()),
      filename: this.filename,
      fileSize: this.file.size,
      timestamp: Date.now()
    }

    const key = `multipart-upload-${this.state.key}`
    localStorage.setItem(key, JSON.stringify(resumeData))
  }

  /**
   * Load resume state from localStorage
   */
  private async loadResumeState(): Promise<void> {
    const key = `multipart-upload-${this.state.key}`
    const resumeData = localStorage.getItem(key)
    
    if (resumeData) {
      try {
        const data = JSON.parse(resumeData)
        
        // Check if this is the same file
        if (data.filename === this.filename && data.fileSize === this.file.size) {
          // Check if upload is still valid (within 24 hours)
          const age = Date.now() - data.timestamp
          if (age < 24 * 60 * 60 * 1000) {
            this.state.completedParts = new Map(data.completedParts)
            console.log(`Resuming upload: ${this.state.completedParts.size}/${this.state.partCount} parts completed`)
          } else {
            // Clean up old resume data
            localStorage.removeItem(key)
          }
        }
      } catch (error) {
        console.warn('Failed to parse resume data:', error)
        localStorage.removeItem(key)
      }
    }
  }

  /**
   * Clean up resume state
   */
  private cleanupResumeState(): void {
    const key = `multipart-upload-${this.state.key}`
    localStorage.removeItem(key)
  }

  /**
   * Detect mobile device
   */
  private detectMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator as any).connection?.effectiveType === 'slow-2g' ||
           (navigator as any).connection?.effectiveType === '2g' ||
           (navigator as any).connection?.effectiveType === '3g'
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Abort the upload
   */
  abort(): void {
    this.abortController.abort()
  }

  /**
   * Get current upload state
   */
  getState(): MultipartUploadState {
    return { ...this.state }
  }
}

// Export convenience function
export const createMultipartUpload = (
  file: File,
  filename: string,
  contentType: string,
  config?: MultipartUploadConfig
): MultipartUploadManager => {
  return new MultipartUploadManager(file, filename, contentType, config)
}
