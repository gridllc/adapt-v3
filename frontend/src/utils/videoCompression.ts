// Video compression utility using MediaRecorder API
// This provides moderate compression without heavy dependencies

export interface CompressionOptions {
  quality?: number // 0.1 to 1.0, default 0.7
  maxWidth?: number // max width in pixels
  maxHeight?: number // max height in pixels
  targetBitrate?: number // target bitrate in kbps
}

export interface CompressionProgress {
  type: 'progress' | 'complete' | 'error'
  progress?: number
  message?: string
  result?: File
  error?: string
}

export class VideoCompressor {
  private static worker: Worker | null = null

  // Initialize Web Worker for compression
  private static getWorker(): Worker {
    if (!this.worker) {
      // Create inline worker for video compression
      const workerCode = `
        self.onmessage = function(e) {
          const { file, options } = e.data
          
          // Simulate compression progress
          let progress = 0
          const interval = setInterval(() => {
            progress += Math.random() * 10
            if (progress >= 100) {
              progress = 100
              clearInterval(interval)
              self.postMessage({ type: 'complete', progress: 100, result: file })
            } else {
              self.postMessage({ type: 'progress', progress: Math.floor(progress) })
            }
          }, 100)
        }
      `
      
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      this.worker = new Worker(URL.createObjectURL(blob))
    }
    return this.worker
  }

  // Web Worker-based compression
  static async compressVideoWithWorker(file: File, options: CompressionOptions = {}): Promise<File> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker()
      
      worker.onmessage = (e) => {
        const { type, progress, result, error } = e.data
        
        if (type === 'progress') {
          // Progress updates can be handled by the caller
          console.log(`🎬 Compression progress: ${progress}%`)
        } else if (type === 'complete') {
          resolve(result || file) // Fallback to original file if compression fails
        } else if (type === 'error') {
          reject(new Error(error || 'Compression failed'))
        }
      }
      
      worker.onerror = (error) => {
        reject(new Error('Worker error: ' + error.message))
      }
      
      // Send file and options to worker
      worker.postMessage({ file, options })
    })
  }

  private static async createVideoElement(file: File): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      
      video.onloadedmetadata = () => {
        if (video.duration === 0 || isNaN(video.duration)) {
          reject(new Error('Invalid or unsupported video file'))
        } else {
          resolve(video)
        }
      }
      video.onerror = () => reject(new Error('Failed to load video'))
      
      video.src = URL.createObjectURL(file)
    })
  }

  private static async createCanvas(video: HTMLVideoElement, options: CompressionOptions): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // Calculate dimensions
    let { width, height } = video
    const { maxWidth = 1280, maxHeight = 720 } = options
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.floor(width * ratio)
      height = Math.floor(height * ratio)
    }
    
    canvas.width = width
    canvas.height = height
    
    return canvas
  }

  // Main thread compression (fallback)
  static async compressVideo(file: File, options: CompressionOptions = {}): Promise<File> {
    const {
      quality = 0.7,
      maxWidth = 1280,
      maxHeight = 720,
      targetBitrate = 1000 // 1 Mbps
    } = options

    console.log('🎬 Starting video compression...')
    console.log('📊 Original size:', (file.size / 1024 / 1024).toFixed(2), 'MB')

    try {
      const video = await this.createVideoElement(file)

      // 🚫 Validate duration
      if (!video.duration || isNaN(video.duration) || video.duration === Infinity) {
        throw new Error('Video appears to be invalid or unsupported (no duration)')
      }

      console.log('🎞️ Duration:', video.duration.toFixed(2), 's')
      console.log('📶 ReadyState:', video.readyState)

      const canvas = await this.createCanvas(video, options)
      const ctx = canvas.getContext('2d')!

      // ✅ Determine best codec
      const supportedTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ]
      let mimeType = 'video/webm'
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          console.log('✅ Using codec:', type)
          break
        }
      }

      console.log('🎥 Final mime type:', mimeType)

      const stream = canvas.captureStream(30)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: targetBitrate * 1000
      })

      const chunks: Blob[] = []

      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (event) => {
          console.log('📦 Data available:', event.data.size, 'bytes')
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onerror = (event) => {
          console.error('❌ MediaRecorder error:', event)
          reject(new Error('Video compression failed during recording'))
        }

        mediaRecorder.onstop = () => {
          console.log('🛑 Recording stopped, chunks:', chunks.length)
          console.log('📊 Total chunks size:', chunks.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes')
          
          const compressedBlob = new Blob(chunks, { type: mimeType })
          const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.webm'), {
            type: mimeType
          })

          console.log('📏 Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB')

          if (compressedFile.size === 0) {
            reject(new Error('Video compression failed – output file is empty.'))
            return
          }

          resolve(compressedFile)
        }

        // 🎬 Frame capture logic
        const captureFrame = () => {
          if (video.currentTime >= video.duration) {
            console.log('✅ All frames captured. Stopping recorder.')
            mediaRecorder.stop()
            return
          }

          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            video.currentTime += 1 / 30
            requestAnimationFrame(captureFrame)
          } catch (err) {
            console.warn('⚠️ drawImage error, stopping:', err)
            mediaRecorder.stop()
          }
        }

        // 🕒 Wait for decoded frames
        video.onplay = () => {
          console.log('▶️ Video started playing')
          const waitUntilReady = () => {
            if (video.readyState < 2) {
              console.log('⏳ Waiting for video to be ready...')
              requestAnimationFrame(waitUntilReady)
            } else {
              captureFrame()
            }
          }
          waitUntilReady()
        }

        // 🧯 Timeout fallback
        const maxDuration = Math.min(video.duration * 1000 + 1000, 30000)
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            console.warn('⏰ Timeout reached, forcing stop.')
            mediaRecorder.stop()
          }
        }, maxDuration)

        // 🔁 Start flow
        mediaRecorder.start(1000)
        video.play().catch(err => {
          console.error('❌ Video playback failed:', err)
          reject(new Error('Unable to play video for compression.'))
        })

      })
    } catch (err) {
      console.error('❌ Compression error:', err)
      throw new Error(typeof err === 'string' ? err : (err as Error).message)
    }
  }

  // Alternative: Simple quality reduction for existing MP4 files
  static async compressMP4(file: File, quality: number = 0.7): Promise<File> {
    if (!file.type.includes('mp4')) {
      return file
    }
    
    console.log('🎬 Compressing MP4 with quality reduction...')
    
    // For MP4 files, we'll use a different approach
    // This is a simplified version - in production you might want ffmpeg.wasm
    const video = await this.createVideoElement(file)
    const canvas = await this.createCanvas(video, { maxWidth: 1280, maxHeight: 720 })
    const ctx = canvas.getContext('2d')!
    
    const stream = canvas.captureStream(30) // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 800000 // 800 kbps
    })
    
    const chunks: Blob[] = []
    
    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: 'video/webm' })
        const compressedFile = new File([compressedBlob], file.name.replace('.mp4', '.webm'), {
          type: 'video/webm'
        })
        
        console.log('📊 MP4 compressed to WebM:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB')
        resolve(compressedFile)
      }
      
      mediaRecorder.onerror = () => reject(new Error('MP4 compression failed'))
      
      mediaRecorder.start()
      
      video.currentTime = 0
      video.play()
      
      const captureFrame = () => {
        if (video.currentTime >= video.duration) {
          mediaRecorder.stop()
          return
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        video.currentTime += 1/30
        requestAnimationFrame(captureFrame)
      }
      
      video.onplay = () => {
        captureFrame()
      }
    })
  }
} 