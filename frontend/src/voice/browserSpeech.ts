// src/voice/browserSpeech.ts
export type SpeechResult = { text: string; isFinal: boolean };

export type BrowserSpeechHandlers = {
  onStart?: () => void;
  onResult?: (res: SpeechResult) => void;
  onPartial?: (text: string) => void;  // ✅ interim results
  onEnd?: () => void;
  onDenied?: () => void;
  onUnsupported?: () => void;
  onError?: (e: Error) => void;
};

export type BrowserSpeech = {
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
  setContinuous: (continuous: boolean) => void;  // ✅ continuous mode control
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export function createBrowserSpeech(h: BrowserSpeechHandlers): BrowserSpeech {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    h.onUnsupported?.();
    // Return no-op implementation to keep callers safe
    return {
      start: async () => Promise.resolve(),
      stop: () => {},
      destroy: () => {},
      setContinuous: () => {},
    };
  }

  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = true;  // ✅ enable interim results
  rec.continuous = true;      // ✅ start in continuous mode
  rec.maxAlternatives = 1;

  let destroyed = false;
  let continuous = true;      // ✅ track continuous mode state

  rec.onstart = () => !destroyed && h.onStart?.();

  rec.onend = () => {
    if (destroyed) return;
    // ✅ auto-restart if continuous mode is enabled
    if (continuous) {
      try {
        rec.start();
      } catch (e) {
        // Safari might throw if already started; swallow
      }
    }
    h.onEnd?.();
  };

  rec.onerror = (ev: any) => {
    if (destroyed) return;
    const err = String(ev?.error || "");
    if (err === "not-allowed" || err === "service-not-allowed") {
      h.onDenied?.();
      return;
    }
    if (err === "no-speech") {
      // benign when user is quiet; don't spam errors
      return;
    }
    h.onError?.(new Error(err || "speech-error"));
  };

  rec.onresult = (ev: any) => {
    if (destroyed) return;
    // Always use the most recent result index
    const idx = ev.resultIndex ?? 0;
    const res = ev.results?.[idx];
    if (!res) return;

    const text = res[0]?.transcript?.trim?.() ?? "";
    if (!text) return;

    if (res.isFinal) {
      h.onResult?.({ text, isFinal: true });  // ✅ final phrase
    } else {
      h.onPartial?.(text);  // ✅ interim phrase
    }
  };

  const setContinuous = (v: boolean) => {
    continuous = v;
    rec.continuous = v as any;
  };

  return {
    start: async () => {
      if (destroyed) return;
      try {
        rec.start();
      } catch (e) {
        // Safari can throw "start" when already started; swallow
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {}
    },
    destroy: () => {
      destroyed = true;
      try {
        rec.abort?.();
        rec.stop?.();
      } catch {}
    },
    setContinuous,  // ✅ expose continuous mode control
  };
}
