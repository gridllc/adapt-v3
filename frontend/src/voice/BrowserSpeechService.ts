import { SpeechService, PartialListener, SpeechServiceOptions } from "./SpeechService";

// Replace NodeJS.Timeout with number for browser TS
type TimeoutId = number | undefined;

export class BrowserSpeechService implements SpeechService {
  private recognition?: any; // Use any to handle webkitSpeechRecognition
  private onResultCb?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>;
  private onErrorCb?: PartialListener<{ error: string; message: string; raw?: any }>;
  private onEndCb?: PartialListener<void>;
  private onPartialCb?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>;
  private options: SpeechServiceOptions;
  private isListening = false;
  private stopping = false;              // prevent start while stopping
  private shouldAutoRestart = false;     // separate from isListening
  private autoRestartTimeout?: TimeoutId;
  private maxListenTimeout?: TimeoutId;

  // Debug logging for voice recognition diagnostics
  private debug(tag: string, data?: any) {
    const msg = `[VC:${new Date().toISOString().slice(11,23)}] ${tag} ${data ? JSON.stringify(data) : ""}`;
    (window as any).__vcLogs = (window as any).__vcLogs || [];
    (window as any).__vcLogs.push(msg);
    if (localStorage.getItem("VC_DEBUG") === "1") console.log(msg);
  }

  constructor(options: SpeechServiceOptions = {}) {
    this.options = {
      lang: 'en-US',
      continuous: false,
      interimResults: true,
      autoRestart: true,
      maxListenMs: 15000,
      preferredVoices: ['Google', 'Natural', 'Microsoft'],
      suspendSttWhileTts: true,
      ...options
    };

    // Use webkitSpeechRecognition for iOS Safari compatibility
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.debug("create.SR", { hasSR: !!SR });
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = this.options.lang;
      // Note: continuous and interimResults may not be supported in all browsers
      if ('continuous' in this.recognition) {
        this.recognition.continuous = !!this.options.continuous;
      }
      if ('interimResults' in this.recognition) {
        this.recognition.interimResults = !!this.options.interimResults;
      }
      this.recognition.maxAlternatives = 1;

      // Set up event handlers
      this.recognition.onstart = () => { 
        this.debug("sr.onstart"); 
        this.isListening = true; 
      };
      this.recognition.onend = () => { 
        this.debug("sr.onend"); 
        this.isListening = false; 
        this.stopping = false; 
        this.onEndCb?.();
        
        // Auto-restart based on flag, not isListening (which is false here)
        if (this.options.autoRestart && this.shouldAutoRestart) {
          if (this.autoRestartTimeout) window.clearTimeout(this.autoRestartTimeout);
          this.autoRestartTimeout = window.setTimeout(() => {
            // Avoid double starts
            if (!this.isListening && !this.stopping) {
              this.startListening().catch(() => {/* swallow */});
            }
          }, 350);
        }
      };
      this.recognition.onerror = (e: any) => {
        this.debug("sr.onerror", { error: e?.error });
        const rawCode = e?.error || 'speech_error';
        const map: Record<string, { code: string; message: string }> = {
          'not-allowed': { code: 'NOT_ALLOWED', message: 'Microphone permission denied' },
          'service-not-allowed': { code: 'SERVICE_NOT_ALLOWED', message: 'Speech service not allowed' },
          'no-speech': { code: 'NO_SPEECH', message: 'No speech detected' },
          'audio-capture': { code: 'AUDIO_CAPTURE', message: 'Microphone not available' },
          'aborted': { code: 'ABORTED', message: 'Recognition aborted' },
        };
        const norm = map[rawCode] || { code: rawCode.toUpperCase(), message: e?.message || 'Speech recognition error' };
        this.onErrorCb?.({ error: norm.code, message: norm.message, raw: e });
        this.isListening = false;
        this.stopping = false;
      };

      this.recognition.onresult = (e: any) => {
        // Use the latest result index
        const idx = e.resultIndex ?? (e.results?.length ? e.results.length - 1 : 0);
        const res = e.results?.[idx];
        if (!res) return;
        const alt = res[0];
        const transcript = alt?.transcript ?? '';
        const confidence = typeof alt?.confidence === 'number' ? alt.confidence : 0;
        const isFinal = !!res.isFinal;

        if (isFinal) {
          // Final result
          this.onResultCb?.({ transcript, confidence, isFinal: true });
        } else {
          // Partial result
          this.onPartialCb?.({ transcript, confidence, isFinal: false });
        }
      };
    }
  }

  // New: compatibility used by your hook
  isSupported() {
    const secure = typeof window !== 'undefined' ? window.isSecureContext : true;
    return secure && this.isSttAvailable() && this.isTtsAvailable();
  }

  isSttAvailable() { 
    return !!this.recognition; 
  }

  isTtsAvailable() { 
    return "speechSynthesis" in window; 
  }

  async startListening(
    onResult?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>,
    onError?: PartialListener<{ error: string; message: string; raw?: any }>,
    onEnd?: PartialListener<void>,
    onPartial?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>
  ): Promise<boolean> {
    this.debug("sr.startListening.call");
    if (!this.recognition) {
      const err = new Error('STT not supported');
      this.debug("sr.startListening.error", { error: "NOT_SUPPORTED" });
      this.onErrorCb?.({ error: 'NOT_SUPPORTED', message: err.message, raw: err });
      throw err;
    }
    if (this.isListening || this.stopping) return true; // already active or stopping

    // Set callbacks
    if (onResult) this.onResultCb = onResult;
    if (onError) this.onErrorCb = onError;
    if (onEnd) this.onEndCb = onEnd;
    if (onPartial) this.onPartialCb = onPartial;

    // clear timers
    if (this.autoRestartTimeout) { 
      window.clearTimeout(this.autoRestartTimeout); 
      this.autoRestartTimeout = undefined; 
    }
    if (this.maxListenTimeout) { 
      window.clearTimeout(this.maxListenTimeout); 
      this.maxListenTimeout = undefined; 
    }

    try {
      this.shouldAutoRestart = true;
      // Start listening
      this.recognition.start();
      this.debug("sr.start() invoked");
      
      // Set timeout for max listen duration
      if (this.options.maxListenMs) {
        this.maxListenTimeout = window.setTimeout(() => {
          if (this.isListening) {
            this.stopListening();
          }
        }, this.options.maxListenMs);
      }

      // Set timeout guard to check if onstart fired
      setTimeout(() => {
        if (!this.isListening) this.debug("sr.onstart.missed", { hint: "gesture/perm" });
      }, 400);

      return true;
    } catch (e: any) {
      this.debug("sr.start.throw", { msg: (e as Error).message });
      const code = (e?.name || '').toLowerCase();
      const norm = code.includes('notallowed') ? { error: 'NOT_ALLOWED', message: 'Microphone permission denied', raw: e }
                 : code.includes('invalidstate') ? { error: 'INVALID_STATE', message: 'Recognition already started', raw: e }
                 : { error: 'START_FAILED', message: 'Failed to start speech recognition', raw: e };
      this.onErrorCb?.(norm);
      this.isListening = false;
      this.shouldAutoRestart = false;
      return false;
    }
  }
  
  async stopListening() {
    if (!this.recognition) return;
    if (!this.isListening) { 
      this.shouldAutoRestart = false; 
      return; 
    }

    // clear timers
    if (this.maxListenTimeout) { 
      window.clearTimeout(this.maxListenTimeout); 
      this.maxListenTimeout = undefined; 
    }
    if (this.autoRestartTimeout) { 
      window.clearTimeout(this.autoRestartTimeout); 
      this.autoRestartTimeout = undefined; 
    }

    this.shouldAutoRestart = false;
    this.isListening = false;
    this.stopping = true;
    try { 
      this.recognition.stop(); 
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }

  async stopSpeaking() {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.error('Error stopping speech synthesis:', error);
    }
  }
  
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

  // ---- TTS with STT suspension ----
  async speak(text: string, options?: { resumeSttAfter?: boolean }) {
    if (!this.isTtsAvailable()) return;

    const shouldSuspend = !!this.options.suspendSttWhileTts && this.isListening;
    if (shouldSuspend) {
      await this.stopListening(); // ensure mic is not active to avoid echo on mobile
    }

    // Cancel any existing speech
    this.cancelSpeak();
    
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.options.lang || 'en-US';
      
      // Set voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferredVoice = voices.find(voice => 
          this.options.preferredVoices?.some(pref => 
            voice.name.includes(pref)
          )
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }
      
      utterance.onend = () => {
        resolve();
        // Resume STT if requested
        if (options?.resumeSttAfter && this.options.suspendSttWhileTts) {
          // small delay to let audio pipeline settle
          window.setTimeout(() => { 
            this.startListening().catch(() => {}); 
          }, 250);
        }
      };
      
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        resolve();
      };
      
      try { 
        window.speechSynthesis.speak(utterance); 
      } catch (error) {
        console.error('Failed to start speech synthesis:', error);
        resolve();
      }
    });
  }

  cancelSpeak() {
    try { 
      window.speechSynthesis.cancel(); 
    } catch (error) {
      console.error('Error canceling speech synthesis:', error);
    }
  }

  setLanguage(lang: string) {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      let voices = window.speechSynthesis.getVoices();
      
      if (voices.length > 0) {
        resolve(voices);
      } else {
        // Wait for voices to load
        const onVoicesChanged = () => {
          voices = window.speechSynthesis.getVoices();
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          resolve(voices);
        };
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        
        // Fallback timeout
        window.setTimeout(() => {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          resolve(window.speechSynthesis.getVoices());
        }, 1000);
      }
    });
  }

  destroy() {
    this.cancelSpeak();
    this.shouldAutoRestart = false;
    if (this.maxListenTimeout) window.clearTimeout(this.maxListenTimeout);
    if (this.autoRestartTimeout) window.clearTimeout(this.autoRestartTimeout);
    this.maxListenTimeout = undefined;
    this.autoRestartTimeout = undefined;

    this.stopListening();
    
    try { 
      this.recognition?.stop(); 
    } catch (error) {
      console.error('Error stopping recognition during destroy:', error);
    }
  }
}
