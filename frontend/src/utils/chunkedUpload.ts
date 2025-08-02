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
    
    while (offset < file.size) {
      chunks.push(file.slice(offset, offset + chunkSize))
      offset += chunkSize
    }
    
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

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const response = await fetch(API_CONFIG.getApiUrl('/api/upload/chunk'), {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

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

    console.log('🚀 Starting chunked upload...')
    console.log('📊 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
    console.log('🔧 Chunk size:', (chunkSize / 1024 / 1024).toFixed(2), 'MB')
    console.log('⚡ Max concurrent:', maxConcurrent)

    const chunks = this.createChunks(file, chunkSize)
    const totalChunks = chunks.length
    
    console.log('📦 Total chunks:', totalChunks)

    // Upload all chunks
    const uploadTasks = chunks.map((chunk, index) => 
      this.uploadChunk(chunk, index, totalChunks, moduleId, retryAttempts, retryDelay)
    )
    
    await this.processChunksConcurrently(uploadTasks, maxConcurrent, onProgress)

    // Finalize upload
    console.log('✅ All chunks uploaded, finalizing...')
    const finalizeResponse = await fetch(API_CONFIG.getApiUrl('/api/upload/finalize'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        moduleId,
        originalFilename: file.name,
        totalChunks
      })
    })

    if (!finalizeResponse.ok) {
      throw new Error('Failed to finalize upload')
    }

    const result = await finalizeResponse.json()
    console.log('🎉 Upload completed successfully')
    
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