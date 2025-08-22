import { useEffect, useRef, useState } from "react";

type QaResponse = { success: boolean; answer?: string; error?: string };

const api = (p: string) =>
  (import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}${p}` : p);

function pickVoice(name?: string, lang = "en-US"): SpeechSynthesisVoice | null {
  const list = window.speechSynthesis.getVoices();
  if (name) {
    const exact = list.find(v => v.name === name);
    if (exact) return exact;
  }
  return list.find(v => v.lang?.startsWith(lang)) ?? null;
}

export function useVoiceAsk(moduleId: string, {
  lang = import.meta.env.VITE_VOICE_LANG || "en-US",
  voiceName = import.meta.env.VITE_VOICE_NAME || undefined,
} = {}) {
  const [listening, setListening]   = useState(false);
  const [partial, setPartial]       = useState("");
  const [finalText, setFinalText]   = useState("");
  const [answer, setAnswer]         = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);

  // Preload voices once (Chrome loads async)
  useEffect(() => {
    const fn = () => window.speechSynthesis.getVoices();
    fn();
    window.speechSynthesis.onvoiceschanged = fn;
    return () => { window.speechSynthesis.onvoiceschanged = null as any; };
  }, []);

  function ensureRecognizer(): SpeechRecognition {
    if (recRef.current) return recRef.current;
    const SR = (window.webkitSpeechRecognition || window.SpeechRecognition);
    if (!SR) throw new Error("SpeechRecognition not supported in this browser");
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
      if (final)   setFinalText(final.trim());
    };
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    recRef.current = rec;
    return rec;
  }

  async function start() {
    setPartial(""); setFinalText(""); setAnswer("");
    // warm up TTS on mobile (unlocks audio output)
    try { window.speechSynthesis.cancel(); } catch {}
    const rec = ensureRecognizer();
    setListening(true);
    rec.start();
  }
  function stop() { recRef.current?.stop(); }

  async function askQa(text: string): Promise<QaResponse> {
    const r = await fetch(api("/api/qa/ask"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, question: text }),
    });
    return r.json();
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

  // When we get the final transcript, call QA and speak the answer
  useEffect(() => {
    if (!finalText) return;
    (async () => {
      setAnswer("");
      const res = await askQa(finalText);
      if (res?.success && res.answer) {
        setAnswer(res.answer);
        speak(res.answer);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalText]);

  return { listening, partial, finalText, answer, start, stop };
}
