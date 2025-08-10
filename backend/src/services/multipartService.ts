import { 
  createMultipartUpload, 
  getSignedUploadPartUrl, 
  completeMultipartUpload, 
  abortMultipartUpload,
  isS3Configured 
} from './s3Uploader.js'
import { v4 as uuidv4 } from 'uuid'

export interface MultipartInitResponse {
  uploadId: string
  key: string
  partSize: number
  partCount: number
}

export interface MultipartPartSignResponse {
  url: string
  partNumber: number
}

export interface MultipartCompleteRequest {
  parts: Array<{
    partNumber: number
    etag: string
  }>
}

export interface MultipartCompleteResponse {
  success: boolean
  key: string
  etag?: string
  location?: string
  moduleId?: string
  videoUrl?: string
}

export class MultipartService {
  private readonly MIN_PART_SIZE = 5 * 1024 * 1024 // 5MB minimum for S3
  private readonly MAX_PART_SIZE = 100 * 1024 * 1024 // 100MB maximum for efficiency
  private readonly DEFAULT_DESKTOP_PART_SIZE = 16 * 1024 * 1024 // 16MB for desktop
  private readonly DEFAULT_MOBILE_PART_SIZE = 8 * 1024 * 1024 // 8MB for mobile

  /**
   * Initialize a multipart upload
   */
  async initializeUpload(
    filename: string,
    contentType: string,
    fileSize: number,
    isMobile: boolean = false
  ): Promise<MultipartInitResponse> {
    if (!isS3Configured()) {
      throw new Error('S3 is not configured')
    }

    // Validate inputs
    if (!filename || filename.trim().length === 0) {
      throw new Error('Filename is required')
    }

    if (fileSize <= 0) {
      throw new Error('File size must be greater than 0')
    }

    // Generate unique key with timestamp and UUID
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const uniqueId = uuidv4().replace(/-/g, '').slice(0, 16)
    const extension = filename.split('.').pop() || 'bin'
    const key = `uploads/${timestamp}/${uniqueId}.${extension}`

    // Calculate optimal part size based on device and file size
    const partSize = this.calculateOptimalPartSize(fileSize, isMobile)
    const partCount = Math.ceil(fileSize / partSize)

    // Validate part count (S3 limit is 10,000 parts)
    if (partCount > 10000) {
      throw new Error(`File too large: would require ${partCount} parts (max 10,000)`)
    }

    console.log(`🚀 Initializing multipart upload:`, {
      filename,
      key,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      partSize: `${(partSize / 1024 / 1024).toFixed(2)}MB`,
      partCount,
      isMobile
    })

    try {
      // Create multipart upload on S3
      const uploadId = await createMultipartUpload(key, contentType)

      console.log(`✅ Multipart upload initialized:`, {
        uploadId: uploadId.slice(0, 16) + '...',
        key,
        partCount
      })

      return {
        uploadId,
        key,
        partSize,
        partCount
      }
    } catch (error) {
      console.error('❌ Failed to initialize multipart upload:', error)
      throw new Error(`Failed to initialize upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get signed URL for uploading a specific part
   */
  async getSignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string> {
    if (!isS3Configured()) {
      throw new Error('S3 is not configured')
    }

    // Validate inputs
    if (!key || !uploadId) {
      throw new Error('Key and uploadId are required')
    }

    if (partNumber < 1 || partNumber > 10000) {
      throw new Error('Part number must be between 1 and 10000')
    }

    console.log(`🔗 Generating signed URL for part ${partNumber}:`, {
      key,
      uploadId: uploadId.slice(0, 16) + '...',
      partNumber
    })

    try {
      // Generate signed URL for this part (10 minutes expiry)
      const signedUrl = await getSignedUploadPartUrl(key, uploadId, partNumber, 600)

      console.log(`✅ Signed URL generated for part ${partNumber}`)

      return signedUrl
    } catch (error) {
      console.error(`❌ Failed to generate signed URL for part ${partNumber}:`, error)
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Complete the multipart upload
   */
  async completeUpload(
    key: string,
    uploadId: string,
    parts: MultipartCompleteRequest['parts']
  ): Promise<MultipartCompleteResponse> {
    if (!isS3Configured()) {
      throw new Error('S3 is not configured')
    }

    // Validate inputs
    if (!key || !uploadId) {
      throw new Error('Key and uploadId are required')
    }

    if (!parts || parts.length === 0) {
      throw new Error('Parts array is required and cannot be empty')
    }

    // Validate parts format
    for (const part of parts) {
      if (!part.partNumber || !part.etag) {
        throw new Error('Each part must have partNumber and etag')
      }
      if (part.partNumber < 1 || part.partNumber > 10000) {
        throw new Error(`Invalid part number: ${part.partNumber}`)
      }
    }

    console.log(`🏁 Completing multipart upload:`, {
      key,
      uploadId: uploadId.slice(0, 16) + '...',
      partCount: parts.length
    })

    try {
      // Format parts for S3 API
      const s3Parts = parts.map(part => ({
        ETag: part.etag,
        PartNumber: part.partNumber
      }))

      // Complete the multipart upload
      const result = await completeMultipartUpload(key, uploadId, s3Parts)

      console.log(`✅ Multipart upload completed:`, {
        key,
        etag: result.ETag?.slice(0, 16) + '...',
        location: result.Location
      })

      // Generate video URL for the uploaded file
      const videoUrl = result.Location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${key}`
      
      // Generate a module ID (you might want to integrate this with your module creation logic)
      const moduleId = uuidv4()

      return {
        success: true,
        key,
        etag: result.ETag,
        location: result.Location,
        moduleId,
        videoUrl
      }
    } catch (error) {
      console.error('❌ Failed to complete multipart upload:', error)
      
      // Try to abort the upload to clean up
      try {
        await this.abortUpload(key, uploadId)
        console.log('🗑️ Aborted incomplete upload')
      } catch (abortError) {
        console.warn('⚠️ Failed to abort upload during error cleanup:', abortError)
      }

      throw new Error(`Failed to complete upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Abort a multipart upload
   */
  async abortUpload(key: string, uploadId: string): Promise<{ success: boolean }> {
    if (!isS3Configured()) {
      throw new Error('S3 is not configured')
    }

    if (!key || !uploadId) {
      throw new Error('Key and uploadId are required')
    }

    console.log(`🗑️ Aborting multipart upload:`, {
      key,
      uploadId: uploadId.slice(0, 16) + '...'
    })

    try {
      await abortMultipartUpload(key, uploadId)
      
      console.log(`✅ Multipart upload aborted successfully`)
      
      return { success: true }
    } catch (error) {
      console.error('❌ Failed to abort multipart upload:', error)
      throw new Error(`Failed to abort upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Calculate optimal part size based on file size and device type
   */
  private calculateOptimalPartSize(fileSize: number, isMobile: boolean): number {
    // Start with device-appropriate base size
    let partSize = isMobile ? this.DEFAULT_MOBILE_PART_SIZE : this.DEFAULT_DESKTOP_PART_SIZE

    // For very large files, increase part size to stay under 10,000 parts limit
    const maxParts = 9000 // Leave some buffer under 10,000 limit
    if (fileSize / partSize > maxParts) {
      partSize = Math.ceil(fileSize / maxParts)
    }

    // Ensure part size is within S3 limits
    partSize = Math.max(partSize, this.MIN_PART_SIZE)
    partSize = Math.min(partSize, this.MAX_PART_SIZE)

    // Round to nearest MB for cleaner logging
    partSize = Math.ceil(partSize / (1024 * 1024)) * 1024 * 1024

    return partSize
  }

  /**
   * Get upload statistics and recommendations
   */
  getUploadMetrics(fileSize: number, isMobile: boolean = false) {
    const partSize = this.calculateOptimalPartSize(fileSize, isMobile)
    const partCount = Math.ceil(fileSize / partSize)
    const estimatedTime = this.estimateUploadTime(fileSize, isMobile)

    return {
      fileSize,
      partSize,
      partCount,
      estimatedTime,
      isMobile,
      recommendations: {
        useWifi: fileSize > 100 * 1024 * 1024, // Recommend WiFi for 100MB+
        allowBackgroundUpload: fileSize > 50 * 1024 * 1024 // Background for 50MB+
      }
    }
  }

  /**
   * Estimate upload time based on file size and device
   */
  private estimateUploadTime(fileSize: number, isMobile: boolean): { min: number; max: number } {
    // Rough estimates based on typical speeds (MB/s)
    const desktopSpeed = { min: 2, max: 10 } // 2-10 MB/s
    const mobileSpeed = { min: 0.5, max: 3 } // 0.5-3 MB/s
    
    const speed = isMobile ? mobileSpeed : desktopSpeed
    const fileSizeMB = fileSize / (1024 * 1024)
    
    return {
      min: Math.ceil(fileSizeMB / speed.max), // seconds
      max: Math.ceil(fileSizeMB / speed.min)  // seconds
    }
  }
}

// Export singleton instance
export const multipartService = new MultipartService()