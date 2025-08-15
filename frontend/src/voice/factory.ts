import { SpeechService } from "./SpeechService";
import { BrowserSpeechService } from "./BrowserSpeechService";
import { GoogleSpeechService } from "./GoogleSpeechService";
import { VOICE_PROVIDER } from "../config/app";

export function createSpeechService(): SpeechService {
  const provider = VOICE_PROVIDER.toUpperCase();
  if (provider === "GOOGLE") return new GoogleSpeechService();
  return new BrowserSpeechService({ lang: "en-US" });
}
