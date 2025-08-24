import { useEffect, useRef, useState } from "react";

type QaResponse = { success: boolean; answer?: string; error?: string };

const api = (p: string) =>
  (import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}${p}` : p);

export type VoiceController = {
  listening: boolean;
  partial: string;
  finalText: string;
  answer: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  startWithPrefix: (prefix: string) => void; // NEW for contextual ask
  askText: (text: string) => Promise<void>;
};

export function useVoiceAsk(
  moduleId: string,
  {
    lang = import.meta.env.VITE_VOICE_LANG || "en-US",
    voiceName = import.meta.env.VITE_VOICE_NAME || undefined,
    onAnswer,
    onError,
  }: {
    lang?: string;
    voiceName?: string;
    onAnswer?: (answer: string) => void;
    onError?: (msg: string) => void;
  } = {}
): VoiceController {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const nextPrefixRef = useRef<string>(""); // NEW: contextual prefix for next question

  // preload voices once so TTS is ready (even if you only use text toast)
  useEffect(() => {
    const preload = () => window.speechSynthesis.getVoices();
    preload();
    window.speechSynthesis.onvoiceschanged = preload;
    return () => { window.speechSynthesis.onvoiceschanged = null as any; };
  }, []);

  function pickVoice(name?: string, langCode = "en-US"): SpeechSynthesisVoice | null {
    const list = window.speechSynthesis.getVoices();
    if (name) {
      const exact = list.find(v => v.name === name);
      if (exact) return exact;
    }
    return list.find(v => v.lang?.startsWith(langCode)) ?? null;
  }

  function ensureRecognizer(): SpeechRecognition {
    if (recRef.current) return recRef.current;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      const msg = "SpeechRecognition not supported in this browser";
      setError(msg); onError?.(msg);
      throw new Error(msg);
    }
    const rec: SpeechRecognition = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setPartial(interim);
      if (final) setFinalText(final.trim());
    };

    rec.onend = () => {
      setListening(false);
      navigator.vibrate?.(10); // haptic on stop
    };

    rec.onerror = (evt: any) => {
      setListening(false);
      const code = evt?.error || "unknown";
      const msg =
        code === "not-allowed"
          ? "Microphone blocked. Allow mic access in your browser settings."
          : code === "service-not-allowed"
          ? "Speech service not allowed. Check site permissions."
          : code === "no-speech"
          ? "I didn't catch that. Try again."
          : `Voice error: ${code}`;
      setError(msg);
      onError?.(msg);
    };

    recRef.current = rec;
    return rec;
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(voiceName, lang);
    if (v) u.voice = v;
    u.lang = lang;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  async function askQa(text: string): Promise<QaResponse> {
    const r = await fetch(api("api/qa/ask"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, question: text }),
    });
    return r.json();
  }

  async function askText(text: string) {
    setAnswer("");
    const res = await askQa(text);
    if (res?.success && res.answer) {
      setAnswer(res.answer);
      onAnswer?.(res.answer);
      // keep TTS too
      speak(res.answer);
    } else if (res?.error) {
      setError(res.error); onError?.(res.error);
    }
  }

  async function start() {
    try {
      setError(null); setPartial(""); setFinalText(""); setAnswer("");
      // haptic on start
      navigator.vibrate?.(15);
      window.speechSynthesis.cancel();
      const rec = ensureRecognizer();
      setListening(true);
      rec.start();
    } catch (e: any) {
      const msg = e?.message || "Cannot start voice";
      setError(msg); onError?.(msg);
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  function startWithPrefix(prefix: string) {
    nextPrefixRef.current = prefix || "";
    start();
  }

  // When a final transcript arrives, send QA (with optional prefix), then clear prefix
  useEffect(() => {
    if (!finalText) return;
    const q = nextPrefixRef.current
      ? `${nextPrefixRef.current} ${finalText}`.trim()
      : finalText;
    nextPrefixRef.current = "";
    void askText(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalText]);

  return { listening, partial, finalText, answer, error, start, stop, startWithPrefix, askText };
}
