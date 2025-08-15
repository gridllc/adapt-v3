import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Step = { id: string; start: number; end: number; title: string; description: string };

export type VoiceCoachOptions = {
  steps: Step[];
  currentIndex: number;
  onStepChange: (i: number) => void;
  onSeek: (t: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  getCurrentTime?: () => number;
  onMute?: () => void;
  onUnmute?: () => void;
  speechOptions?: { rate?: number; pitch?: number; volume?: number; voice?: string; lang?: string };
};

type Intent =
  | { type: "next"; confidence?: number; matched?: string }
  | { type: "prev"; confidence?: number; matched?: string }
  | { type: "repeat"; confidence?: number; matched?: string }
  | { type: "goto"; n: number; confidence?: number; matched?: string }
  | { type: "unknown"; confidence?: number; matched?: string };

type CommonAPI = {
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  partialTranscript?: string;
  lastIntent?: Intent;
  error?: string;
  disambiguationPrompt?: string;
  toast?: string;
  startVoiceCoach: () => void;
  stopVoiceCoach: () => void;
  startListening: () => void;
  stopListening: () => void;
  nextStep: () => void;
  previousStep: () => void;
  repeatStep: () => void;
  currentStepInfo: () => void;
  clearDisambiguation: () => void;
  confidenceLevel: "high" | "medium" | "low";
};

function useVoiceCoachMode() {
  const [mode, setMode] = useState<"webspeech" | "recorder" | "none">("none");
  useEffect(() => {
    // decide once on mount; no hooks inside
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) setMode("webspeech");
    else if (navigator.mediaDevices?.getUserMedia) setMode("recorder");
    else setMode("none");
  }, []);
  return mode;
}

/** --- Web Speech path (enabled-gated) --- */
function useWebSpeechCoach(enabled: boolean, opts: VoiceCoachOptions): CommonAPI {
  const recRef = useRef<any>(null);
  const [isActive, setActive] = useState(false);
  const [isListening, setListening] = useState(false);
  const [isSpeaking] = useState(false); // you can wire TTS later
  const [transcript, setTranscript] = useState("");
  const [partialTranscript, setPartial] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [lastIntent, setIntent] = useState<Intent | undefined>();
  const [disambiguationPrompt, setDisamb] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  const startVoiceCoach = useCallback(() => {
    if (!enabled) return;
    setActive(true);
  }, [enabled]);

  const stopVoiceCoach = useCallback(() => {
    setActive(false);
    setListening(false);
    try { recRef.current?.stop?.(); } catch {}
  }, []);

  const startListening = useCallback(() => {
    if (!enabled || !isActive) return;
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = opts.speechOptions?.lang || "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onstart = () => setListening(true);
      rec.onerror = (e: any) => { setError(String(e.error || e.message || e)); setListening(false); };
      rec.onresult = (e: any) => {
        let full = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const res = e.results[i];
          if (res.isFinal) full += res[0].transcript;
          else setPartial(String(res[0].transcript || ""));
        }
        if (full) setTranscript(full.trim());
      };
      rec.onend = () => { setListening(false); setPartial(undefined); };
      recRef.current = rec;
      rec.start();
    } catch (e: any) {
      setError(e?.name ? `${e.name}: ${e.message}` : String(e));
    }
  }, [enabled, isActive, opts.speechOptions?.lang]);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop?.(); } catch {}
  }, []);

  // simple intent parser (placeholder)
  useEffect(() => {
    if (!transcript) return;
    const txt = transcript.toLowerCase();
    if (/\b(next|forward)\b/.test(txt)) setIntent({ type: "next", matched: "next", confidence: 0.9 });
    else if (/\b(prev|back)\b/.test(txt)) setIntent({ type: "prev", matched: "prev", confidence: 0.9 });
    else if (/\brepeat|again\b/.test(txt)) setIntent({ type: "repeat", matched: "repeat", confidence: 0.9 });
    else if (/step\s+(\d{1,2})/.test(txt)) setIntent({ type: "goto", n: Number(txt.match(/step\s+(\d{1,2})/)![1]), matched: "goto", confidence: 0.8 });
    else setIntent({ type: "unknown", confidence: 0.4 });
  }, [transcript]);

  const nextStep = useCallback(() => {
    const i = Math.min(opts.currentIndex + 1, opts.steps.length - 1);
    if (i !== opts.currentIndex) { opts.onStepChange(i); opts.onSeek(opts.steps[i].start); }
  }, [opts]);

  const previousStep = useCallback(() => {
    const i = Math.max(opts.currentIndex - 1, 0);
    if (i !== opts.currentIndex) { opts.onStepChange(i); opts.onSeek(opts.steps[i].start); }
  }, [opts]);

  const repeatStep = useCallback(() => {
    if (!opts.steps.length) return;
    const i = Math.max(Math.min(opts.currentIndex, opts.steps.length - 1), 0);
    opts.onSeek(opts.steps[i].start);
  }, [opts]);

  const currentStepInfo = useCallback(() => {
    const s = opts.steps[opts.currentIndex];
    if (s) setToast(`You are on step ${opts.currentIndex + 1}: ${s.title}`);
  }, [opts]);

  const clearDisambiguation = useCallback(() => setDisamb(undefined), []);

  const confidenceLevel: "high" | "medium" | "low" = useMemo(() => {
    const c = (lastIntent?.confidence ?? 0);
    if (c >= 0.8) return "high";
    if (c >= 0.55) return "medium";
    return "low";
  }, [lastIntent?.confidence]);

  return {
    isActive, isListening, isSpeaking,
    transcript, partialTranscript, lastIntent, error,
    disambiguationPrompt, toast,
    startVoiceCoach, stopVoiceCoach, startListening, stopListening,
    nextStep, previousStep, repeatStep, currentStepInfo, clearDisambiguation,
    confidenceLevel,
  };
}

/** --- MediaRecorder/Cloud STT path (enabled-gated, minimal no-crash impl) --- */
function useRecorderCoach(enabled: boolean, opts: VoiceCoachOptions): CommonAPI {
  const [isActive, setActive] = useState(false);
  const [isListening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | undefined>();

  const startVoiceCoach = useCallback(() => { if (enabled) setActive(true); }, [enabled]);
  const stopVoiceCoach  = useCallback(() => { setActive(false); setListening(false); }, []);
  const startListening  = useCallback(async () => {
    if (!enabled || !isActive) return;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }); // prime permission
      setListening(true);
      // TODO: start MediaRecorder and send chunks to your /api/ai/transcribe-stream, then setTranscript(...)
    } catch (e: any) {
      setError(e?.name ? `${e.name}: ${e.message}` : String(e));
    }
  }, [enabled, isActive]);
  const stopListening   = useCallback(() => setListening(false), []);

  // reuse the same step helpers
  const base = useWebSpeechCoach(false, opts); // calls but disabled -> no side effects
  return {
    ...base,
    isActive, isListening,
    transcript,
    error,
    startVoiceCoach, stopVoiceCoach, startListening, stopListening,
  };
}

/** --- Public hook with stable hook order --- */
export function useVoiceCoach(opts: VoiceCoachOptions) {
  const mode = useVoiceCoachMode();                 // 'webspeech' | 'recorder' | 'none'
  const web = useWebSpeechCoach(mode === "webspeech", opts);
  const rec = useRecorderCoach(mode === "recorder",  opts);

  const api = mode === "webspeech" ? web : rec;
  const isSupported = mode !== "none";

  return { ...api, isSupported };
}
