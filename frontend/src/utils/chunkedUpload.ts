// Chunked upload utility with concurrent processing
// This splits large files into chunks and uploads them in parallel

import { API_CONFIG } from '../config/api'

export interface ChunkUploadOptions {
  chunkSize?: number // Default 2MB
  maxConcurrent?: number // Default 3
  retryAttempts?: number // Default 3
  retryDelay?: number // Default 1000ms
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  currentChunk: number
  totalChunks: number
}

export class ChunkedUploader {
  private static createChunks(file: File, chunkSize: number): Blob[] {
    const chunks: Blob[] = []
    let offset = 0
    
    // Ensure we always have at least one chunk, even for small files
    if (file.size === 0) {
      // Handle empty files by creating a single empty chunk
      chunks.push(new Blob([], { type: file.type }))
      console.log(`📦 Created 1 chunk for empty file`)
    } else {
      while (offset < file.size) {
        const end = Math.min(offset + chunkSize, file.size)
        chunks.push(file.slice(offset, end))
        offset += chunkSize
      }
      
      // If no chunks were created (shouldn't happen with the while loop), create one
      if (chunks.length === 0) {
        chunks.push(file.slice(0, file.size))
        console.log(`📦 Created 1 chunk for small file (${file.size} bytes)`)
      }
    }
    
    console.log(`📦 Created ${chunks.length} chunks from file of size ${file.size} bytes`)
    return chunks
  }

  private static async uploadChunk(
    chunk: Blob, 
    index: number, 
    totalChunks: number, 
    moduleId: string,
    retryAttempts: number = 3,
    retryDelay: number = 1000
  ): Promise<Response> {
    const formData = new FormData()
    formData.append('chunk', chunk, `chunk-${index}`)
    formData.append('chunkIndex', index.toString())
    formData.append('totalChunks', totalChunks.toString())
    formData.append('moduleId', moduleId)

    console.log(`📤 Uploading chunk ${index}/${totalChunks} for module ${moduleId}`)
    console.log(`📦 Chunk size: ${(chunk.size / 1024).toFixed(2)} KB`)
    console.log(`📋 FormData contents:`, {
      chunkIndex: index.toString(),
      totalChunks: totalChunks.toString(),
      moduleId: moduleId,
      chunkSize: chunk.size
    })

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        // FIXED: Use correct endpoint path
        const response = await fetch(API_CONFIG.getApiUrl('/api/upload/chunk'), {
          method: 'POST',
          body: formData,
        })

        console.log(`📡 Chunk ${index} response status:`, response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Chunk ${index} upload failed:`, response.status, errorText)
          
          // Try to parse error as JSON for better error messages
          try {
            const errorJson = JSON.parse(errorText)
            throw new Error(`HTTP ${response.status}: ${errorJson.error || response.statusText}`)
          } catch {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        }

        const responseData = await response.json()
        console.log(`✅ Chunk ${index} uploaded successfully:`, responseData)
        return response
      } catch (error) {
        console.warn(`Chunk ${index} upload attempt ${attempt + 1} failed:`, error)
        
        if (attempt === retryAttempts - 1) {
          throw error
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    }

    throw new Error(`Failed to upload chunk ${index} after ${retryAttempts} attempts`)
  }

  private static async processChunksConcurrently(
    tasks: Promise<Response>[], 
    maxConcurrent: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<Response[]> {
    const results: Response[] = []
    const executing: Promise<void>[] = []
    let completed = 0

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const p = task.then(res => {
        results.push(res)
        completed++
        
        if (onProgress) {
          onProgress({
            loaded: completed,
            total: tasks.length,
            percentage: (completed / tasks.length) * 100,
            currentChunk: completed,
            totalChunks: tasks.length
          })
        }
      })
      
      executing.push(p)

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing)
        // Remove the completed task from executing array
        const completedTaskIndex = executing.findIndex(promise => promise === p)
        if (completedTaskIndex !== -1) {
          executing.splice(completedTaskIndex, 1)
        }
      }
    }

    await Promise.all(executing)
    return results
  }

  static async uploadVideoInChunks(
    file: File, 
    moduleId: string, 
    options: ChunkUploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ moduleId: string; videoUrl: string }> {
    const {
      chunkSize = 2 * 1024 * 1024, // 2MB
      maxConcurrent = 3,
      retryAttempts = 3,
      retryDelay = 1000
    } = options

    // Check for empty file
    if (file.size === 0) {
      throw new Error('Cannot upload empty file. Please select a valid video file.')
    }

    console.log('🚀 Starting chunked upload...')
    console.log('📊 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
    console.log('🔧 Chunk size:', (chunkSize / 1024 / 1024).toFixed(2), 'MB')
    console.log('⚡ Max concurrent:', maxConcurrent)
    console.log('🆔 Module ID:', moduleId)

    const chunks = this.createChunks(file, chunkSize)
    const totalChunks = chunks.length
    
    console.log('📦 Total chunks:', totalChunks)

    // Validate that we have chunks to upload
    if (totalChunks === 0) {
      throw new Error('No chunks created from file. File may be empty or corrupted.')
    }

    // Ensure we have at least 1 chunk (fallback)
    const finalTotalChunks = Math.max(1, totalChunks)
    if (finalTotalChunks !== totalChunks) {
      console.log(`⚠️ Adjusted total chunks from ${totalChunks} to ${finalTotalChunks}`)
    }

    // For very small files, we might want to use a different approach
    if (finalTotalChunks === 1 && file.size < chunkSize) {
      console.log('📦 Small file detected, using single chunk upload')
    }

    // Upload all chunks
    const uploadTasks = chunks.map((chunk, index) => 
      this.uploadChunk(chunk, index, finalTotalChunks, moduleId, retryAttempts, retryDelay)
    )
    
    await this.processChunksConcurrently(uploadTasks, maxConcurrent, onProgress)

    // Finalize upload
    console.log('✅ All chunks uploaded, finalizing...')
    
    const finalizeData = {
      moduleId,
      originalFilename: file.name,
      totalChunks: finalTotalChunks
    }
    console.log('📤 Finalize data:', finalizeData)
    
    // FIXED: Use correct endpoint path
    const finalizeResponse = await fetch(API_CONFIG.getApiUrl('/api/upload/finalize'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalizeData)
    })

    console.log('📡 Finalize response status:', finalizeResponse.status)

    if (!finalizeResponse.ok) {
      const errorText = await finalizeResponse.text()
      console.error('Finalize failed:', finalizeResponse.status, errorText)
      
      // Try to parse error as JSON for better error messages
      try {
        const errorJson = JSON.parse(errorText)
        throw new Error(`Failed to finalize upload: ${finalizeResponse.status} ${JSON.stringify(errorJson)}`)
      } catch {
        throw new Error(`Failed to finalize upload: ${finalizeResponse.status} ${errorText}`)
      }
    }

    const result = await finalizeResponse.json()
    console.log('🎉 Upload completed successfully:', result)
    
    return {
      moduleId: result.moduleId,
      videoUrl: result.videoUrl
    }
  }

  // Helper method to estimate upload time
  static estimateUploadTime(fileSize: number, options: ChunkUploadOptions = {}): number {
    const { chunkSize = 2 * 1024 * 1024, maxConcurrent = 3 } = options
    const totalChunks = Math.ceil(fileSize / chunkSize)
    const estimatedChunksPerSecond = maxConcurrent * 2 // Rough estimate
    return Math.ceil(totalChunks / estimatedChunksPerSecond)
  }
} 