// backend/src/services/multipartService.ts
import { v4 as uuidv4 } from 'uuid'
import {
  createMultipartUpload,
  getSignedUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  getPublicS3Url,
} from './s3Uploader.js'

export interface MultipartUploadInit {
  key: string
  uploadId: string
  partSize: number
  partCount: number
}

export interface MultipartPart {
  partNumber: number
  etag: string
}

export interface PartSizeStrategy {
  partSize: number
  partCount: number
  maxConcurrent: number
}

export const multipartService = {
  /**
   * Calculate optimal part size and concurrency based on file size and device capabilities
   */
  calculatePartStrategy(fileSize: number, isMobile: boolean = false): PartSizeStrategy {
    // S3 limits: 5MB min per part, 10,000 max parts, 5TB max file
    const MIN_PART_SIZE = 5 * 1024 * 1024  // 5MB
    const MAX_PART_SIZE = 100 * 1024 * 1024 // 100MB
    const MAX_PARTS = 10000

    let partSize = MIN_PART_SIZE
    let partCount = Math.ceil(fileSize / partSize)

    // If we exceed max parts, increase part size
    while (partCount > MAX_PARTS && partSize < MAX_PART_SIZE) {
      partSize *= 2
      partCount = Math.ceil(fileSize / partSize)
    }

    // Device-specific optimization
    if (isMobile) {
      // Mobile: smaller parts, fewer concurrent uploads
      partSize = Math.max(MIN_PART_SIZE, 5 * 1024 * 1024) // 5MB
      partCount = Math.ceil(fileSize / partSize)
      return {
        partSize,
        partCount,
        maxConcurrent: 2
      }
    } else {
      // Desktop: larger parts, more concurrent uploads
      if (fileSize <= 100 * 1024 * 1024) { // Files under 100MB
        partSize = Math.max(MIN_PART_SIZE, 8 * 1024 * 1024) // 8MB
      } else if (fileSize <= 1024 * 1024 * 1024) { // Files under 1GB  
        partSize = 16 * 1024 * 1024 // 16MB
      } else {
        partSize = 32 * 1024 * 1024 // 32MB for larger files
      }
      
      partCount = Math.ceil(fileSize / partSize)
      return {
        partSize,
        partCount,
        maxConcurrent: 4
      }
    }
  },

  /**
   * Initialize a new multipart upload
   */
  async initializeUpload(
    filename: string, 
    contentType: string,
    fileSize: number,
    isMobile: boolean = false
  ): Promise<MultipartUploadInit> {
    try {
      // Generate unique key
      const key = `videos/${uuidv4()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      
      // Calculate optimal part strategy
      const { partSize, partCount, maxConcurrent } = this.calculatePartStrategy(fileSize, isMobile)
      
      // Initialize multipart upload
      const uploadId = await createMultipartUpload(key, contentType)
      
      return {
        key,
        uploadId,
        partSize,
        partCount,
      }
    } catch (error) {
      console.error('Failed to initialize multipart upload:', error)
      throw new Error(`Failed to initialize upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Get signed URL for uploading a specific part
   */
  async getSignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string> {
    try {
      return await getSignedUploadPartUrl(key, uploadId, partNumber, 3600) // 1 hour expiry
    } catch (error) {
      console.error('Failed to generate signed part URL:', error)
      throw new Error(`Failed to generate part URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Complete the multipart upload
   */
  async completeUpload(
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<{ etag: string; location: string }> {
    try {
      // Sort parts by part number to ensure correct order
      const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber)
      
      // Convert to S3 SDK format
      const sdkParts = sortedParts.map(part => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      }))
      
      const result = await completeMultipartUpload(key, uploadId, sdkParts)
      
      // Extract ETag and construct location
      const etag = (result as any).ETag || ''
      const location = getPublicS3Url(key)
      
      return { etag, location }
    } catch (error) {
      console.error('Failed to complete multipart upload:', error)
      throw new Error(`Failed to complete upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Abort the multipart upload
   */
  async abortUpload(key: string, uploadId: string): Promise<void> {
    try {
      await abortMultipartUpload(key, uploadId)
    } catch (error) {
      console.error('Failed to abort multipart upload:', error)
      throw new Error(`Failed to abort upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  },

  /**
   * Validate upload parts before completion
   */
  validateParts(parts: MultipartPart[], expectedPartCount: number): boolean {
    if (parts.length !== expectedPartCount) {
      return false
    }
    
    // Check for duplicate part numbers
    const partNumbers = parts.map(p => p.partNumber)
    const uniquePartNumbers = new Set(partNumbers)
    
    if (partNumbers.length !== uniquePartNumbers.size) {
      return false
    }
    
    // Check part numbers are sequential
    const sortedNumbers = partNumbers.sort((a, b) => a - b)
    for (let i = 0; i < sortedNumbers.length; i++) {
      if (sortedNumbers[i] !== i + 1) {
        return false
      }
    }
    
    return true
  }
}