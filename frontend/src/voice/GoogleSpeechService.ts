import { SpeechService, PartialListener } from "./SpeechService";

/**
 * Placeholder: uses server endpoints (so keys stay server-side).
 * Only used if VITE_VOICE_PROVIDER=GOOGLE.
 * Implement when you re-enable billing.
 */
export class GoogleSpeechService implements SpeechService {
  private onResultCb?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>;
  private onErrorCb?: PartialListener<{ error: string; message: string; raw?: any }>;
  private onEndCb?: PartialListener<void>;
  private onPartialCb?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>;

  isSttAvailable() { return true; }  // we'll support push-to-talk upload
  isTtsAvailable() { return true; }

  // New: compatibility used by your hook
  isSupported() {
    const secure = typeof window !== 'undefined' ? window.isSecureContext : true;
    return secure && this.isSttAvailable() && this.isTtsAvailable();
  }

  async startListening(
    onResult?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>,
    onError?: PartialListener<{ error: string; message: string; raw?: any }>,
    onEnd?: PartialListener<void>,
    onPartial?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>
  ) {
    // Set callbacks
    if (onResult) this.onResultCb = onResult;
    if (onError) this.onErrorCb = onError;
    if (onEnd) this.onEndCb = onEnd;
    if (onPartial) this.onPartialCb = onPartial;

    // Placeholder: show a modal to record with MediaRecorder,
    // POST to /api/voice/stt (server uses Google STT), then:
    // this.onResultCb?.({ transcript, confidence: 0.9, isFinal: true })
    this.onErrorCb?.({ error: "NOT_IMPLEMENTED", message: "Google STT not implemented in this build.", raw: null });
    return false;
  }

  async stopListening() { /* noop for now */ }

  onResult(cb: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>) { 
    this.onResultCb = cb; 
  }
  
  onError(cb: PartialListener<{ error: string; message: string; raw?: any }>) { 
    this.onErrorCb = cb; 
  }

  onEnd(cb: PartialListener<void>) {
    this.onEndCb = cb;
  }

  onPartial(cb: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>) {
    this.onPartialCb = cb;
  }

  async speak(text: string, options?: { resumeSttAfter?: boolean }) {
    // Placeholder: POST {text} to /api/voice/tts → returns audio URL/arrayBuffer
    // Then play it:
    // const res = await fetch('/api/voice/tts', { method:'POST', body: JSON.stringify({text})});
    // const blob = await res.blob();
    // const url = URL.createObjectURL(blob);
    // new Audio(url).play();
    console.warn("Google TTS placeholder called:", text);
  }

  async stopSpeaking() { /* noop for now */ }
  
  cancelSpeak() { /* noop for now */ }
  
  setLanguage(lang: string) { /* noop for now */ }
  
  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    return [];
  }
  
  destroy() { /* noop for now */ }
}
