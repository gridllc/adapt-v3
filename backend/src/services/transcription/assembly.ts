import { AssemblyAI } from "assemblyai";
import { presignedUploadService } from "../presignedUploadService.js";
import { ModuleService } from "../moduleService.js";

const AAI = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

function requireHttpsBaseUrl() {
  const base = process.env.API_BASE_URL?.trim();
  if (!base || !/^https:\/\//i.test(base)) {
    throw new Error("API_BASE_URL must be a full https URL (ex: https://adapt-v3.onrender.com)");
  }
  return base.replace(/\/+$/g, ""); // trim trailing slashes
}

export async function createTranscript(moduleId: string, audioUrl: string) {
  // 1) Build a proper https webhook URL with moduleId and token
  const base = requireHttpsBaseUrl();
  const webhookUrl = `${base}/webhooks/assemblyai?moduleId=${encodeURIComponent(moduleId)}&token=${encodeURIComponent(process.env.ASSEMBLYAI_WEBHOOK_SECRET || '')}`;

  // 2) Submit transcript job with webhook
  const transcript = await AAI.transcripts.create({
    audio_url: audioUrl,
    // Recommended options
    speaker_labels: false,
    punctuate: true,
    format_text: true,
    language_detection: true,

    // Webhook back to us - AssemblyAI will use standard aai-signature header
    webhook_url: webhookUrl,
    // Remove custom auth headers - let AssemblyAI handle signature verification
  });

  // Save job id for status/debug
  await ModuleService.updateTranscriptJobId(moduleId, transcript.id);

  console.log(`🎣 [${moduleId}] AssemblyAI transcript job created:`, {
    jobId: transcript.id,
    webhookUrl: webhookUrl,
    audioUrl: audioUrl
  });

  return { jobId: transcript.id, webhookUrl };
}

// Called by webhook to fetch final text
export async function getTranscript(transcriptId: string) {
  return AAI.transcripts.get(transcriptId);
}
