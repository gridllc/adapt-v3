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
//   region: process.env.S3_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// })

export async function transcribeS3Video(moduleId: string, filename: string) {
  const tmpAudio = path.join(tmpdir(), `${moduleId}-audio.mp3`)
  const videoPath = path.join(process.cwd(), 'uploads', filename)

  try {
    console.log(`🎤 Starting transcription for module ${moduleId}`)
    console.log(`📁 Video file: ${videoPath}`)
    
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`)
    }

    // Step 1: Extract audio to MP3 using ffmpeg
    console.log(`🎵 Extracting audio from video...`)
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    try {
      await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 "${tmpAudio}"`)
      console.log(`✅ Audio extracted to: ${tmpAudio}`)
    } catch (ffmpegError) {
      console.error('❌ FFmpeg error:', ffmpegError)
      // Fallback: create a sample transcript
      console.log('⚠️ Using sample transcript due to FFmpeg error')
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
    console.log(`🤖 Transcribing with OpenAI Whisper...`)
    if (!openai) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY environment variable.')
    }
    
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpAudio),
      model: 'whisper-1',
      response_format: 'json',
    })

    console.log(`✅ Transcription completed: ${transcript.text.length} characters`)

    // Step 3: Save transcript
    const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
    await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
    await fs.promises.writeFile(savePath, JSON.stringify({
      text: transcript.text,
      language: 'en',
      moduleId,
      createdAt: new Date().toISOString()
    }, null, 2))

    console.log(`💾 Transcript saved to: ${savePath}`)
    return transcript.text
  } catch (err) {
    console.error('❌ Transcription error:', err)
    
    // Create error transcript file
    try {
      const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
      await fs.promises.writeFile(savePath, JSON.stringify({
        text: "Transcription failed. Please check the video file and try again.",
        error: err instanceof Error ? err.message : 'Unknown error',
        moduleId,
        createdAt: new Date().toISOString()
      }, null, 2))
    } catch (writeError) {
      console.error('❌ Failed to write error transcript:', writeError)
    }
    
    throw err
  } finally {
    // Cleanup temporary audio file
    try { 
      if (fs.existsSync(tmpAudio)) {
        fs.unlinkSync(tmpAudio)
        console.log(`🗑️ Cleaned up temporary audio: ${tmpAudio}`)
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temporary audio:', cleanupError)
    }
  }
}