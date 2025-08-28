// src/hooks/useVoiceAsk.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSpeech, BrowserSpeech } from "../voice/browserSpeech";

type UseVoiceAskOpts = {
  onAnswer?: (text: string) => void;
  onError?: (msg: string) => void;
};

export type VoiceController = {
  // state
  listening: boolean;
  status: "idle" | "listening" | "denied" | "unsupported" | "error";
  interimTranscript: string;
  finalTranscript: string;
  lastAnswer: string;
  // actions
  start: () => Promise<void>;
  startWithPrefix: (prefix: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
  setContinuous: (v: boolean) => void;
};

const API = (path: string) =>
  `${import.meta.env.VITE_API_BASE_URL ?? ""}${path}` || `/api${path}`;

export function useVoiceAsk(moduleId: string, opts: UseVoiceAskOpts = {}): VoiceController {
  const { onAnswer, onError } = opts;
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<VoiceController["status"]>("idle");
  const [interimTranscript, setInterim] = useState("");
  const [finalTranscript, setFinal] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [continuous, setContinuous] = useState(true);

  const svcRef = useRef<BrowserSpeech | null>(null);
  const prefixRef = useRef<string>("");

  useEffect(() => {
    // init browser speech
    try {
      const svc = createBrowserSpeech({
        onStart: () => {
          setStatus("listening");
          setListening(true);
          setInterim("");
        },
        onResult: (r) => {
          if (r.isFinal) {
            setFinal(r.text);
            setInterim("");
            void askAI((prefixRef.current + " " + r.text).trim());
            prefixRef.current = "";
          }
        },
        onPartial: (text) => {
          setInterim(text);  // ✅ show interim text while user speaks
        },
        onEnd: () => {
          if (!continuous) {
            setListening(false);
            setStatus("idle");
          }
          // continuous mode auto-restarts handled by browserSpeech service
        },
        onDenied: () => {
          setStatus("denied");
          setListening(false);
        },
        onUnsupported: () => {
          setStatus("unsupported");
          setListening(false);
        },
        onError: (e) => {
          setStatus("error");
          setListening(false);
          onError?.(e?.message || "Voice recognition error");
        },
      });
      svcRef.current = svc;
      svc.setContinuous(continuous); // set initial continuous mode
      return () => svc.destroy();
    } catch {
      setStatus("unsupported");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askAI = useCallback(
    async (question: string) => {
      try {
        const res = await fetch(API("/qa/ask"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleId, question }),
        });
        const data = await res.json();
        const answer: string =
          (data && (data.answer || data?.data?.answer)) || "No answer returned.";
        setLastAnswer(answer);
        onAnswer?.(answer);

        // Optional: read the answer out loud using TTS
        try {
          if (svcRef.current && "speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(answer);
            window.speechSynthesis.speak(utterance);
          }
        } catch (e) {
          // TTS failed, but that's ok - we still show the text
        }
      } catch (e: any) {
        const msg = e?.message || "Failed to ask AI.";
        onError?.(msg);
      }
    },
    [moduleId, onAnswer, onError]
  );

  const start = useCallback(async () => {
    if (!svcRef.current) return;
    try {
      await svcRef.current.start();
      setListening(true);
      setStatus("listening");
    } catch (e: any) {
      const msg = e?.message || "Failed to start mic.";
      if (msg.includes("not supported")) setStatus("unsupported");
      else setStatus("error");
      onError?.(msg);
    }
  }, [onError]);

  const startWithPrefix = useCallback(async (prefix: string) => {
    prefixRef.current = prefix;
    await start();
  }, [start]);

  const stop = useCallback(() => {
    svcRef.current?.stop();
    setListening(false);
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setInterim("");
    setFinal("");
    setLastAnswer("");
  }, []);

  const setContinuousMode = useCallback((v: boolean) => {
    setContinuous(v);
    svcRef.current?.setContinuous(v);
  }, []);

  return useMemo(
    () => ({
      listening,
      status,
      interimTranscript: interimTranscript,
      finalTranscript,
      lastAnswer,
      start,
      startWithPrefix,
      stop,
      reset,
      setContinuous: setContinuousMode,
    }),
    [listening, status, interimTranscript, finalTranscript, lastAnswer, start, startWithPrefix, stop, reset, setContinuousMode]
  );
}