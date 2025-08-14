export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal?: boolean;
}

export interface SpeechRecognitionError {
  error: string;   // normalized code
  message: string;
  raw?: any;
}

export interface SpeechServiceOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoRestart?: boolean;     // restart onend/onerror (no-speech, aborted)
  maxListenMs?: number;      // safety timeout for a single session
  preferredVoices?: string[]; // names substrings in priority order
  suspendSttWhileTts?: boolean; // prevent echo
}

type ResultCb = (result: SpeechRecognitionResult) => void;
type ErrorCb  = (error: SpeechRecognitionError) => void;
type VoidCb   = () => void;

export class BrowserSpeechService {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private listenTimer: number | null = null;
  private options: Required<SpeechServiceOptions>;
  private onResult: ResultCb | null = null;
  private onPartial: ResultCb | null = null;
  private onError: ErrorCb | null = null;
  private onEnd: VoidCb | null = null;
  private voicesReady: Promise<SpeechSynthesisVoice[]>;
  private restartPending = false;
  private destroyed = false;

  constructor(opts: SpeechServiceOptions = {}) {
    this.options = {
      lang: opts.lang ?? 'en-US',
      continuous: opts.continuous ?? false,
      interimResults: opts.interimResults ?? true,
      autoRestart: opts.autoRestart ?? true,
      maxListenMs: opts.maxListenMs ?? 15000,
      preferredVoices: opts.preferredVoices ?? ['Google', 'Natural', 'Microsoft'],
      suspendSttWhileTts: opts.suspendSttWhileTts ?? true,
    };

    this.initializeSpeechRecognition();
    this.synthesis = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voicesReady = this.loadVoices();
  }

  /* -------------------- init -------------------- */

  private initializeSpeechRecognition() {
    const W: any = window as any;
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return;

    this.recognition = new Ctor();
    this.recognition.continuous = this.options.continuous;
    this.recognition.interimResults = this.options.interimResults;
    this.recognition.lang = this.options.lang;

    this.recognition.onresult = (event: any) => {
      // deliver partials and finals
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const alt = res[0];
        const payload: SpeechRecognitionResult = {
          transcript: (alt?.transcript || '').trim(),
          confidence: alt?.confidence ?? 0,
          isFinal: res.isFinal,
        };
        if (!payload.transcript) continue;
        if (res.isFinal) {
          this.onResult?.(payload);
        } else {
          this.onPartial?.(payload);
        }
      }
    };

    this.recognition.onnomatch = () => {
      this.onError?.({ error: 'NO_MATCH', message: 'No recognition match' });
    };

    this.recognition.onerror = (event: any) => {
      const code = String(event?.error || 'unknown').toUpperCase().replace(/-/g, '_');
      this.onError?.({
        error: code,
        message: event.message || `Speech recognition error: ${code}`,
        raw: event,
      });
      // Some errors should stop auto-restart (e.g., NOT_ALLOWED without permission).
      if (this.options.autoRestart && this.shouldRestartAfterError(code)) {
        this.scheduleRestart();
      } else {
        this.isListening = false;
      }
    };

    this.recognition.onend = () => {
      this.clearListenTimer();
      const wasListening = this.isListening;
      this.isListening = false;
      this.onEnd?.();
      if (this.options.autoRestart && wasListening && !this.destroyed) {
        this.scheduleRestart();
      }
    };
  }

  private shouldRestartAfterError(code: string) {
    // Do not loop on permission or missing mic errors
    return !['NOT_ALLOWED', 'SERVICE_NOT_ALLOWED', 'AUDIO_CAPTURE'].includes(code);
  }

  private scheduleRestart() {
    if (this.restartPending || this.destroyed) return;
    this.restartPending = true;
    window.setTimeout(() => {
      this.restartPending = false;
      if (!this.destroyed) this.startListeningInternal();
    }, 350); // small backoff
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.synthesis) return Promise.resolve([]);
    const existing = this.synthesis.getVoices();
    if (existing && existing.length) return Promise.resolve(existing);

    return new Promise(resolve => {
      const handler = () => {
        this.synthesis?.removeEventListener('voiceschanged', handler as any);
        resolve(this.synthesis?.getVoices() || []);
      };
      this.synthesis.addEventListener('voiceschanged', handler as any);
      // Fallback timer if event never fires
      window.setTimeout(() => resolve(this.synthesis?.getVoices() || []), 500);
    });
  }

  /* -------------------- public API -------------------- */

  startListening(
    onResult: ResultCb,
    onError: ErrorCb,
    onEnd: VoidCb,
    onPartial?: ResultCb
  ): boolean {
    if (!this.recognition) {
      onError({ error: 'NOT_SUPPORTED', message: 'Speech recognition not supported' });
      return false;
    }
    this.onResult = onResult;
    this.onError = onError;
    this.onEnd = onEnd;
    this.onPartial = onPartial ?? null;
    return this.startListeningInternal();
  }

  private startListeningInternal(): boolean {
    if (!this.recognition) return false;
    if (this.isListening) return true;

    try {
      // If we're about to listen, stop speaking to avoid echo
      if (this.options.suspendSttWhileTts && this.synthesis?.speaking) {
        this.synthesis.cancel();
      }

      this.recognition.lang = this.options.lang;
      this.recognition.continuous = this.options.continuous;
      this.recognition.interimResults = this.options.interimResults;

      this.recognition.start();
      this.isListening = true;

      // Optional safety timeout
      if (this.options.maxListenMs > 0) {
        this.listenTimer = window.setTimeout(() => this.stopListening(), this.options.maxListenMs);
      }
      return true;
    } catch (e) {
      this.onError?.({ error: 'START_FAILED', message: 'Failed to start speech recognition', raw: e });
      this.isListening = false;
      return false;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try { this.recognition.stop(); } catch {}
      this.isListening = false;
    }
    this.clearListenTimer();
  }

  getListeningState(): boolean {
    return this.isListening;
  }

  setLanguage(lang: string) {
    this.options.lang = lang;
    if (this.recognition) this.recognition.lang = lang;
  }

  async speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      voice?: string; // exact or substring
      lang?: string;
      enqueue?: boolean; // if false (default), cancel current speech first
      resumeSttAfter?: boolean; // resume listening after speech ends
    }
  ): Promise<boolean> {
    if (!this.synthesis) {
      console.warn('Speech synthesis not available');
      return false;
    }

    if (!options?.enqueue) this.synthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = options?.rate ?? 1.0;
    utter.pitch = options?.pitch ?? 1.0;
    utter.volume = options?.volume ?? 1.0;
    utter.lang = options?.lang ?? this.options.lang;

    const voices = await this.voicesReady;
    const preferred = this.pickVoice(voices, options?.voice);
    if (preferred) utter.voice = preferred;

    // Pause STT while TTS to avoid echo
    const shouldSuspend = this.options.suspendSttWhileTts && this.isListening;
    if (shouldSuspend) this.stopListening();

    await new Promise<void>(resolve => {
      utter.onend = () => resolve();
      utter.onerror = () => resolve(); // resolve to avoid deadlocks
      this.synthesis!.speak(utter);
    });

    if (options?.resumeSttAfter && !this.destroyed) {
      // small delay gives mic a moment to settle
      window.setTimeout(() => this.startListeningInternal(), 120);
    }
    return true;
  }

  stopSpeaking() {
    this.synthesis?.cancel();
  }

  isSupported(): boolean {
    return Boolean(this.recognition) && Boolean(this.synthesis);
  }

  recognitionSupported(): boolean {
    return Boolean(this.recognition);
  }

  synthesisSupported(): boolean {
    return Boolean(this.synthesis);
  }

  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    return this.voicesReady;
  }

  setPreferredVoices(names: string[]) {
    this.options.preferredVoices = names;
  }

  destroy() {
    this.destroyed = true;
    this.stopListening();
    this.stopSpeaking();
    this.onResult = this.onPartial = this.onError = this.onEnd = null;
  }

  /* -------------------- helpers -------------------- */

  private pickVoice(voices: SpeechSynthesisVoice[], requested?: string) {
    if (!voices?.length) return null;
    if (requested) {
      const exact = voices.find(v => v.name.toLowerCase() === requested.toLowerCase());
      if (exact) return exact;
      const loose = voices.find(v => v.name.toLowerCase().includes(requested.toLowerCase()));
      if (loose) return loose;
    }
    // Fallback preference: en-* + preferred substrings
    const en = voices.filter(v => v.lang?.toLowerCase().startsWith('en'));
    for (const needle of this.options.preferredVoices) {
      const hit = en.find(v => v.name.includes(needle));
      if (hit) return hit;
    }
    return en[0] || voices[0];
  }

  private clearListenTimer() {
    if (this.listenTimer) {
      window.clearTimeout(this.listenTimer);
      this.listenTimer = null;
    }
  }
}
