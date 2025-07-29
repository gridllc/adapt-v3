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

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

// const s3 = new S3Client({
//   region: process.env.S3_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// })

export async function transcribeS3Video(moduleId: string, filename: string) {
  // const tmpAudio = path.join(tmpdir(), `${uuidv4()}.mp3`)
  // const tmpVideo = path.join(tmpdir(), `${uuidv4()}-${filename}`)

  try {
    // Step 1: Download video from S3
    // const videoStream = await s3.send(new GetObjectCommand({
    //   Bucket: process.env.S3_BUCKET_NAME!,
    //   Key: filename,
    // }))
    // const writable = fs.createWriteStream(tmpVideo)
    // await new Promise((resolve, reject) => {
    //   videoStream.Body.pipe(writable).on('finish', resolve).on('error', reject)
    // })

    // Step 2: Extract audio to MP3
    // await new Promise((resolve, reject) => {
    //   ffmpeg(tmpVideo)
    //     .output(tmpAudio)
    //     .audioCodec('libmp3lame')
    //     .on('end', resolve)
    //     .on('error', reject)
    //     .run()
    // })

    // Step 3: Transcribe audio
    // const transcript = await openai.audio.transcriptions.create({
    //   file: fs.createReadStream(tmpAudio),
    //   model: 'whisper-1',
    //   response_format: 'json',
    // })

    // Step 4: Save locally
    const savePath = path.resolve(__dirname, `../data/transcripts/${moduleId}.json`)
    await fs.promises.mkdir(path.dirname(savePath), { recursive: true })
    // await fs.promises.writeFile(savePath, JSON.stringify(transcript.text, null, 2))
    await fs.promises.writeFile(savePath, JSON.stringify("Sample transcript text", null, 2))

    // return transcript.text
    return "Sample transcript text"
  } catch (err) {
    console.error('Transcription error:', err)
    throw err
  } finally {
    // Cleanup
    // try { fs.unlinkSync(tmpAudio) } catch {}
    // try { fs.unlinkSync(tmpVideo) } catch {}
  }
}