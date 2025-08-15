import type { Request, Response } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isGoogleVoiceEnabled, getVoiceStatus } from "../config/voice.js";

export async function voiceHealth(_req: Request, res: Response) {
  const status = getVoiceStatus();
  return res.json({
    ...status,
    note: status.serverVoiceEnabled
      ? (status.googleEnabled
          ? "Server endpoints active; will call Google once libs+creds are present."
          : "Server endpoints active but provider is not GOOGLE. TTS/STT will 501.")
      : "Server endpoints disabled by ENABLE_SERVER_VOICE=false.",
  });
}

export async function ttsHandler(req: Request, res: Response) {
  if (!isGoogleVoiceEnabled()) {
    const status = getVoiceStatus();
    return res.status(501).json({
      error: "VOICE_NOT_ENABLED",
      message: "Server TTS is disabled (enable and set provider to GOOGLE to use).",
      status,
      fallback: "Use browser Web Speech API instead"
    });
  }

  const text: string = (req.body?.text || "").toString().trim();
  const lang: string = (req.body?.lang || "en-US").toString();
  const voiceName: string = (req.body?.voice || "en-US-Neutral").toString();

  if (!text) {
    return res.status(400).json({ error: "NO_TEXT", message: "Missing 'text'." });
  }

  try {
    // Dynamic import so the app still runs when packages aren't installed
    const { synthesizeWithGoogle } = await import("../services/googleSpeech.js");
    const { audioBase64, mime } = await synthesizeWithGoogle({ text, lang, voiceName });
    return res.json({ audioBase64, mime });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const isModuleMissing = /Cannot find module|ERR_MODULE_NOT_FOUND|module not found/i.test(msg);
    return res.status(500).json({
      error: "TTS_FAILED",
      message: isModuleMissing
        ? "Google speech packages not installed. Run: npm i @google-cloud/text-to-speech"
        : msg,
      fallback: "Use browser Web Speech API instead"
    });
  }
}

export async function sttHandler(req: Request, res: Response) {
  if (!isGoogleVoiceEnabled()) {
    const status = getVoiceStatus();
    return res.status(501).json({
      error: "VOICE_NOT_ENABLED",
      message: "Server STT is disabled (enable and set provider to GOOGLE to use).",
      status,
      fallback: "Use browser Web Speech API instead"
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: "NO_AUDIO", message: "Upload 'audio' file (form-data)." });
  }

  const lang: string = (req.body?.lang || "en-US").toString();

  // Persist to a tmp file (some SDKs prefer files over buffers)
  const tmp = path.join(os.tmpdir(), `voice_${Date.now()}`);
  try {
    await fs.writeFile(tmp, req.file.buffer);

    const { recognizeWithGoogle } = await import("../services/googleSpeech.js");
    const transcript = await recognizeWithGoogle({ filePath: tmp, lang });
    return res.json({ transcript });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const isModuleMissing = /Cannot find module|ERR_MODULE_NOT_FOUND|module not found/i.test(msg);
    return res.status(500).json({
      error: "STT_FAILED",
      message: isModuleMissing
        ? "Google speech packages not installed. Run: npm i @google-cloud/speech"
        : msg,
      fallback: "Use browser Web Speech API instead"
    });
  } finally {
    // Clean up temp file
    try { await fs.unlink(tmp); } catch { /* ignore */ }
  }
}
