import { AssemblyAI } from "assemblyai";
import { presignedUploadService } from "../presignedUploadService.js";
import { ModuleService } from "../moduleService.js";

const AAI = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

function requireHttpsBaseUrl(): string {
  const base = (process.env.API_BASE_URL || "").replace(/\/+$/, "");
  if (!base || !/^https?:\/\//i.test(base)) {
    throw new Error(
      "API_BASE_URL must be a full https URL (ex: https://adapt-v3.onrender.com)"
    );
  }
  return base;
}

/**
 * Submit a transcript job to AssemblyAI.
 * @param moduleId - DB id for the module
 * @param s3Key    - S3 key we stored for the uploaded video
 */
export async function submitTranscriptJob(moduleId: string, s3Key: string) {
  // 1) Give AAI a downloadable URL (signed GET)
  //    30–60 min is fine; AAI fetches once at job start.
  const audioUrl = await presignedUploadService.getSignedUrl(s3Key, 3600);

  // 2) Build a proper https webhook URL
  const base = requireHttpsBaseUrl();
  const webhookUrl = `${base}/webhooks/assemblyai?moduleId=${encodeURIComponent(
    moduleId
  )}`;

  // 3) Optional secret header to verify callbacks
  const secret = process.env.ASSEMBLYAI_WEBHOOK_SECRET || "";

  // 4) Kick off job
  const transcript = await AAI.transcripts.create({
    audio_url: audioUrl,
    // Recommended options
    speaker_labels: false,
    punctuate: true,
    format_text: true,
    language_detection: true,

    // Webhook back to us
    webhook_url: webhookUrl,
    webhook_auth_header_name: secret ? "x-webhook-secret" : undefined,
    webhook_auth_header_value: secret || undefined,
  });

  // Save job id for status/debug
  await ModuleService.updateTranscriptJobId(moduleId, transcript.id);

  return { jobId: transcript.id, webhookUrl };
}

// Called by webhook to fetch final text
export async function getTranscript(transcriptId: string) {
  return AAI.transcripts.get(transcriptId);
}
