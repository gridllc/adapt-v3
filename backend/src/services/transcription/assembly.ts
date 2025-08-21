import { AssemblyAI } from "assemblyai";

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

export async function submitTranscriptJob(opts: {
  mediaUrl: string;     // S3 presigned read URL for your uploaded video (or audio)
  moduleId: string;
}) {
  const webhook = `${process.env.API_BASE_URL}/webhooks/assemblyai?moduleId=${opts.moduleId}`;
  const job = await aai.transcripts.submit({
    audio_url: opts.mediaUrl,        // AAI will extract audio from MP4 URL
    webhook_url: webhook,
    punctuate: true,
    format_text: true
  });
  return job.id;                     // store on the Module row
}
