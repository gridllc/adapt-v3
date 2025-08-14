import { SpeechService, PartialListener } from "./SpeechService";

/**
 * Placeholder: uses server endpoints (so keys stay server-side).
 * Only used if VITE_VOICE_PROVIDER=GOOGLE.
 * Implement when you re-enable billing.
 */
export class GoogleSpeechService implements SpeechService {
  private onResultCb?: PartialListener<string>;
  private onErrorCb?: PartialListener<string>;

  isSttAvailable() { return true; }  // we'll support push-to-talk upload
  isTtsAvailable() { return true; }

  async startListening() {
    // Placeholder: show a modal to record with MediaRecorder,
    // POST to /api/voice/stt (server uses Google STT), then:
    // this.onResultCb?.(transcript)
    this.onErrorCb?.("Google STT not implemented in this build.");
  }

  async stopListening() { /* noop for now */ }

  onResult(cb: PartialListener<string>) { this.onResultCb = cb; }
  onError(cb: PartialListener<string>) { this.onErrorCb = cb; }

  async speak(text: string) {
    // Placeholder: POST {text} to /api/voice/tts → returns audio URL/arrayBuffer
    // Then play it:
    // const res = await fetch('/api/voice/tts', { method:'POST', body: JSON.stringify({text})});
    // const blob = await res.blob();
    // const url = URL.createObjectURL(blob);
    // new Audio(url).play();
    console.warn("Google TTS placeholder called:", text);
  }

  cancelSpeak() { /* noop for now */ }
  dispose() { /* noop for now */ }
}
