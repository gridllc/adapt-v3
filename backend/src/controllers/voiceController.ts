import type { Request, Response } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ENABLED = (process.env.ENABLE_SERVER_VOICE || "false").toLowerCase() === "true";
const PROVIDER = (process.env.VOICE_PROVIDER || "BROWSER").toUpperCase(); // BROWSER | GOOGLE
const DEFAULT_LANG = process.env.VOICE_LANG || "en-US";
const DEFAULT_VOICE = process.env.VOICE_VOICE_NAME || "en-US-Neutral";

export async function voiceHealth(_req: Request, res: Response) {
  return res.json({
    enabled: ENABLED,
    provider: PROVIDER,
    lang: DEFAULT_LANG,
    note: ENABLED
      ? (PROVIDER === "GOOGLE"
          ? "Server endpoints active; will call Google once libs+creds are present."
          : "Server endpoints active but provider is not GOOGLE. TTS/STT will 501.")
      : "Server endpoints disabled by ENABLE_SERVER_VOICE=false.",
  });
}

export async function ttsHandler(req: Request, res: Response) {
  if (!ENABLED || PROVIDER !== "GOOGLE") {
    return res.status(501).json({
      error: "VOICE_NOT_ENABLED",
      message: "Server TTS is disabled (enable and set provider to GOOGLE to use).",
    });
  }

  const text: string = (req.body?.text || "").toString().trim();
  const lang: string = (req.body?.lang || DEFAULT_LANG).toString();
  const voiceName: string = (req.body?.voice || DEFAULT_VOICE).toString();

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
    });
  }
}

export async function sttHandler(req: Request, res: Response) {
  if (!ENABLED || PROVIDER !== "GOOGLE") {
    return res.status(501).json({
      error: "VOICE_NOT_ENABLED",
      message: "Server STT is disabled (enable and set provider to GOOGLE to use).",
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: "NO_AUDIO", message: "Upload 'audio' file (form-data)." });
  }

  const lang: string = (req.body?.lang || DEFAULT_LANG).toString();

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
    });
  } finally {
    // Clean up temp file
    try { await fs.unlink(tmp); } catch { /* ignore */ }
  }
}
