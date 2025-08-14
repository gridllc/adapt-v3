import { SpeechService } from "./SpeechService";
import { BrowserSpeechService } from "./BrowserSpeechService";
import { GoogleSpeechService } from "./GoogleSpeechService";

export function createSpeechService(): SpeechService {
  const provider = (import.meta.env.VITE_VOICE_PROVIDER || "BROWSER").toUpperCase();
  if (provider === "GOOGLE") return new GoogleSpeechService();
  return new BrowserSpeechService("en-US");
}
