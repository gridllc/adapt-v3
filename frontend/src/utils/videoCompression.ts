// Video compression utility using MediaRecorder API
// This provides moderate compression without heavy dependencies

export interface CompressionOptions {
  quality?: number // 0.1 to 1.0, default 0.7
  maxWidth?: number // max width in pixels
  maxHeight?: number // max height in pixels
  targetBitrate?: number // target bitrate in kbps
}

export class VideoCompressor {
  private static async createVideoElement(file: File): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      
      video.onloadedmetadata = () => resolve(video)
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
      const canvas = await this.createCanvas(video, options)
      const ctx = canvas.getContext('2d')!
      
      // Create MediaRecorder with compression settings
      const stream = canvas.captureStream()
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: targetBitrate * 1000
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
          const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.webm'), {
            type: 'video/webm'
          })
          
          console.log('📊 Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB')
          console.log('📈 Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%')
          
          resolve(compressedFile)
        }
        
        mediaRecorder.onerror = () => reject(new Error('Compression failed'))
        
        // Start recording
        mediaRecorder.start()
        
        // Play video and capture frames
        video.currentTime = 0
        video.play()
        
        const captureFrame = () => {
          if (video.currentTime >= video.duration) {
            mediaRecorder.stop()
            return
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          video.currentTime += 1/30 // 30 FPS
          requestAnimationFrame(captureFrame)
        }
        
        video.onplay = () => {
          captureFrame()
        }
      })
    } catch (error) {
      console.error('❌ Compression failed:', error)
      // Return original file if compression fails
      return file
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