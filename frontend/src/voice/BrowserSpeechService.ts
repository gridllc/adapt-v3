import { SpeechService, PartialListener } from "./SpeechService";

type AnyRecognition = SpeechRecognition & {
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
};

export class BrowserSpeechService implements SpeechService {
  private recognition?: AnyRecognition;
  private onResultCb?: PartialListener<string>;   // final
  private onErrorCb?: PartialListener<string>;
  private onPartialCb?: PartialListener<string>;  // interim (optional)
  private continuous = true;
  private destroyed = false;

  constructor(lang: string = "en-US") {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec: AnyRecognition = new SR();
    rec.lang = lang;
    rec.interimResults = true;     // ✅ enable interim
    rec.continuous = true;         // ✅ keep listening until stopped
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      // Always use the most recent result index
      const idx = (e as any).resultIndex ?? 0;
      const res: SpeechRecognitionResult | undefined = (e.results as any)?.[idx];
      if (!res) return;

      const text = res[0]?.transcript?.trim?.() ?? "";
      if (!text) return;

      if (res.isFinal) {
        this.onResultCb?.(text);       // final phrase
      } else {
        this.onPartialCb?.(text);      // interim phrase
      }
    };

    rec.onerror = (e: any) => {
      const err = String(e?.error || "speech_error");
      if (err === "not-allowed" || err === "service-not-allowed") {
        this.onErrorCb?.("permission_denied");
        return;
      }
      if (err === "no-speech") {
        // benign when user is quiet; don't spam errors
        return;
      }
      this.onErrorCb?.(err);
    };

    rec.onend = () => {
      if (this.destroyed) return;
      // if continuous is enabled, auto-restart (some browsers stop after silence)
      if (this.continuous) {
        try { rec.start(); } catch {}
      }
    };

    this.recognition = rec;
  }

  isSttAvailable() {
    return !!this.recognition;
  }

  setContinuous(v: boolean) {
    this.continuous = v;
    if (this.recognition) this.recognition.continuous = v as any;
  }

  async startListening() {
    if (!this.recognition) throw new Error("STT not supported");
    try { this.recognition.start(); } catch {}
  }

  async stopListening() {
    try { this.recognition?.stop(); } catch {}
  }

  onResult(cb: PartialListener<string>) { this.onResultCb = cb; }
  onPartial(cb: PartialListener<string>) { this.onPartialCb = cb; } // ✅ optional
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
    this.destroyed = true;
    this.cancelSpeak();
    try {
      this.recognition?.stop();
      (this.recognition as any)?.abort?.();
    } catch {}
  }
}
