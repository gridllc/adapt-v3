// Minimal Google wrappers. Dynamic-import to avoid hard dependency until you enable it.

import fs from "node:fs/promises";

type TtsArgs = { text: string; lang: string; voiceName?: string };
type SttArgs = { filePath: string; lang: string };

function googleClientOptions() {
  // Option A: full JSON in env
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const creds = JSON.parse(json);
      return { credentials: creds };
    } catch {
      // fall through
    }
  }
  // Option B: GOOGLE_APPLICATION_CREDENTIALS points to a file
  return {}; // SDK will use GOOGLE_APPLICATION_CREDENTIALS or metadata
}

export async function synthesizeWithGoogle({ text, lang, voiceName }: TtsArgs) {
  // Lazy import
  const ttsMod: any = await import("@google-cloud/text-to-speech");
  const client = new ttsMod.TextToSpeechClient(googleClientOptions());

  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: voiceName ? { name: voiceName, languageCode: lang } : { languageCode: lang, ssmlGender: "NEUTRAL" },
    audioConfig: { audioEncoding: "MP3" },
  });

  const audioBase64 = Buffer.from(response.audioContent as Buffer).toString("base64");
  return { audioBase64, mime: "audio/mpeg" };
}

export async function recognizeWithGoogle({ filePath, lang }: SttArgs) {
  const speechMod: any = await import("@google-cloud/speech");
  const client = new speechMod.SpeechClient(googleClientOptions());

  const audioBytes = (await fs.readFile(filePath)).toString("base64");

  const [result] = await client.recognize({
    audio: { content: audioBytes },
    config: {
      languageCode: lang,
      enableAutomaticPunctuation: true,
      // Let Google auto-detect; if you know the encoding you can add it here.
      // encoding: "LINEAR16",
    },
  });

  const alternatives = result?.results?.[0]?.alternatives;
  const transcript = alternatives?.[0]?.transcript || "";
  return transcript;
}
