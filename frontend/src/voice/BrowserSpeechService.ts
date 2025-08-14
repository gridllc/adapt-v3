import { SpeechService, PartialListener } from "./SpeechService";

export class BrowserSpeechService implements SpeechService {
  private recognition?: SpeechRecognition;
  private onResultCb?: PartialListener<string>;
  private onErrorCb?: PartialListener<string>;

  constructor(lang: string = "en-US") {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = lang;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.onresult = (e: SpeechRecognitionEvent) => {
        const text = e.results?.[0]?.[0]?.transcript ?? "";
        this.onResultCb?.(text);
      };
      this.recognition.onerror = (e: any) => {
        this.onErrorCb?.(e.error || "speech_error");
      };
      this.recognition.onend = () => {
        // no-op; use push-to-talk UX
      };
    }
  }

  isSttAvailable() {
    return !!this.recognition;
  }

  async startListening() {
    if (!this.recognition) throw new Error("STT not supported");
    this.recognition.start();
  }
  
  async stopListening() {
    this.recognition?.stop();
  }
  
  onResult(cb: PartialListener<string>) { this.onResultCb = cb; }
  onError(cb: PartialListener<string>) { this.onErrorCb = cb; }

  isTtsAvailable() { return "speechSynthesis" in window; }

  async speak(text: string) {
    if (!this.isTtsAvailable()) return;
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => resolve();
      try { window.speechSynthesis.cancel(); } catch {}
      window.speechSynthesis.speak(u);
    });
  }

  cancelSpeak() {
    try { window.speechSynthesis.cancel(); } catch {}
  }

  dispose() {
    this.cancelSpeak();
    try { this.recognition?.stop(); } catch {}
  }
}
