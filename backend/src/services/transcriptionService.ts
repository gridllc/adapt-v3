import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
// import ffmpegPath from '@ffmpeg-installer/ffmpeg'
// import ffmpeg from 'fluent-ffmpeg'
import OpenAI from 'openai'
// import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { tmpdir } from 'os'
// import { v4 as uuidv4 } from 'uuid'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ffmpeg.setFfmpegPath(ffmpegPath.path)

// Initialize OpenAI client with proper error handling
let openai: OpenAI | null = null

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    console.log('✅ OpenAI initialized with API key')
  }
} catch (error) {
  console.error(`❌ Failed to initialize OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`)
}

// const s3 = new S3Client({
//   region: process.env.AWS_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// })

export async function transcribeS3Video(moduleId: string, filename: string) {
  const tmpAudio = path.join(tmpdir(), `${moduleId}-audio.mp3`)
  const videoPath = path.join(process.cwd(), 'uploads', filename)

  try {
    console.log(`🎤 [Transcription] Starting transcription for module ${moduleId}`)
    console.log(`📁 [Transcription] Video file: ${videoPath}`)
    console.log(`📁 [Transcription] Temp audio file: ${tmpAudio}`)
    
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`)
    }

    // Step 1: Extract audio to MP3 using ffmpeg
    console.log(`🎵 [Transcription] Extracting audio from video...`)
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    try {
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 "${tmpAudio}"`
      console.log(`🎵 [Transcription] Running FFmpeg command: ${ffmpegCommand}`)
      
      await execAsync(ffmpegCommand)
      console.log(`✅ [Transcription] Audio extracted to: ${tmpAudio}`)
      
      // Verify audio file was created
      if (!fs.existsSync(tmpAudio)) {
        throw new Error('Audio file was not created by FFmpeg')
      }
      
      const audioStats = fs.statSync(tmpAudio)
      console.log(`📊 [Transcription] Audio file size: ${audioStats.size} bytes`)
      
      if (audioStats.size === 0) {
        throw new Error('Audio file is empty')
      }
      
    } catch (ffmpegError) {
      console.error('❌ [Transcription] FFmpeg error:', ffmpegError)
      console.error('❌ [Transcription] FFmpeg error details:', ffmpegError instanceof Error ? ffmpegError.stack : 'No stack trace')
      
      // Fallback: create a sample transcript
      console.log('⚠️ [Transcription] Using sample transcript due to FFmpeg error')
      const sampleTranscript = {
        text: "This is a sample transcript. The video has been uploaded successfully but transcription failed. Please check your FFmpeg installation.",
        language: "en"
      }
      
      const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
      await fs.promises.writeFile(savePath, JSON.stringify(sampleTranscript, null, 2))
      
      return sampleTranscript.text
    }

    // Step 2: Transcribe audio with OpenAI
    console.log(`🤖 [Transcription] Transcribing with OpenAI Whisper...`)
    if (!openai) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY environment variable.')
    }
    
    console.log(`🔑 [Transcription] OpenAI API key status: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`)
    
    try {
      const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpAudio),
        model: 'whisper-1',
        response_format: 'json',
      })

      if (!transcript || !transcript.text) {
        throw new Error('OpenAI returned empty transcript')
      }

      console.log(`✅ [Transcription] Transcription completed: ${transcript.text.length} characters`)
      console.log(`📝 [Transcription] Transcript preview: ${transcript.text.substring(0, 100)}...`)

      // Step 3: Save transcript
      const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
      await fs.promises.writeFile(savePath, JSON.stringify({
        text: transcript.text,
        language: 'en',
        moduleId,
        createdAt: new Date().toISOString()
      }, null, 2))

      console.log(`💾 [Transcription] Transcript saved to: ${savePath}`)
      return transcript.text
      
    } catch (openaiError) {
      console.error('❌ [Transcription] OpenAI transcription error:', openaiError)
      console.error('❌ [Transcription] OpenAI error details:', openaiError instanceof Error ? openaiError.stack : 'No stack trace')
      
      // Fallback: create a sample transcript
      console.log('⚠️ [Transcription] Using sample transcript due to OpenAI error')
      const sampleTranscript = {
        text: "This is a sample transcript. The video has been uploaded successfully but OpenAI transcription failed. Please check your OpenAI API key and configuration.",
        language: "en"
      }
      
      const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
      await fs.promises.writeFile(savePath, JSON.stringify(sampleTranscript, null, 2))
      
      return sampleTranscript.text
    }
    
  } catch (error) {
    console.error(`❌ [Transcription] Transcription failed for module ${moduleId}:`, error)
    console.error(`❌ [Transcription] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    
    // Return a fallback transcript
    const fallbackTranscript = "This is a fallback transcript. Transcription failed due to an error."
    return fallbackTranscript
  } finally {
    // Cleanup temp audio file
    try {
      if (fs.existsSync(tmpAudio)) {
        fs.unlinkSync(tmpAudio)
        console.log(`🧹 [Transcription] Cleaned up temp audio file: ${tmpAudio}`)
      }
    } catch (cleanupError) {
      console.error(`❌ [Transcription] Failed to cleanup temp audio file:`, cleanupError)
    }
  }
}
