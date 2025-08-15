import { SpeechService } from "./SpeechService";
import { BrowserSpeechService } from "./BrowserSpeechService";
import { GoogleSpeechService } from "./GoogleSpeechService";
import { VOICE_PROVIDER, ENABLE_GOOGLE_VOICE } from "../config/app";

export function createSpeechService(): SpeechService {
  const provider = VOICE_PROVIDER.toUpperCase();
  
  // Only use Google if explicitly enabled and provider is set to GOOGLE
  if (provider === "GOOGLE" && ENABLE_GOOGLE_VOICE) {
    console.log('[Voice] Using Google Speech Service (explicitly enabled)');
    return new GoogleSpeechService();
  }
  
  // Default to Browser Speech Service (Web Speech API)
  console.log('[Voice] Using Browser Speech Service (Web Speech API)');
  return new BrowserSpeechService({ lang: "en-US" });
}
