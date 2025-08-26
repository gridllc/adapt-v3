// src/hooks/useVoiceAsk.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserSpeechService } from "../voice/BrowserSpeechService";

type UseVoiceAskOpts = {
  onAnswer?: (text: string) => void;
  onError?: (msg: string) => void;
};

export type VoiceController = {
  listening: boolean;
  status: "idle" | "listening" | "denied" | "unsupported" | "error";
  interimTranscript: string;
  finalTranscript: string;
  lastAnswer: string;
  start: () => Promise<void>;
  startWithPrefix: (prefix: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
  setContinuous: (v: boolean) => void;
};

const API = (p: string) => `${import.meta.env.VITE_API_BASE_URL ?? ""}${p}` || `/api${p}`;

export function useVoiceAsk(moduleId: string, opts: UseVoiceAskOpts = {}): VoiceController {
  const { onAnswer, onError } = opts;
  const [status, setStatus] = useState<VoiceController["status"]>("idle");
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterim] = useState("");
  const [finalTranscript, setFinal] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const svcRef = useRef<BrowserSpeechService | null>(null);
  const prefixRef = useRef("");

  useEffect(() => {
    const svc = new BrowserSpeechService("en-US");
    svcRef.current = svc;

    if (!svc.isSttAvailable()) {
      setStatus("unsupported");
      return () => svc.dispose();
    }

    // treat permission_denied as denied
    svc.onError((e) => {
      if (e === "permission_denied") {
        setStatus("denied");
        setListening(false);
        return;
      }
      setStatus("error");
      setListening(false);
      onError?.(String(e));
    });

    // show interim while user speaks
    svc.onPartial?.((text: string) => {
      setInterim(text);
    });

    // send to AI when final phrase produced
    svc.onResult((finalText: string) => {
      setFinal(finalText);
      setInterim("");
      void askAI((prefixRef.current + " " + finalText).trim());
      prefixRef.current = "";
    });

    // default to continuous coaching
    svc.setContinuous?.(true);

    return () => svc.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askAI = useCallback(async (question: string) => {
    try {
      const res = await fetch(API("/api/qa/ask"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, question }),
      });
      const data = await res.json();
      const answer = data?.answer ?? data?.data?.answer ?? "No answer returned.";
      setLastAnswer(answer);
      onAnswer?.(answer);

      // optional: read the answer out loud using your TTS
      try { await svcRef.current?.speak?.(answer); } catch {}
    } catch (e: any) {
      const msg = e?.message || "Failed to ask AI.";
      onError?.(msg);
    }
  }, [moduleId, onAnswer, onError]);

  const start = useCallback(async () => {
    if (!svcRef.current) return;
    try {
      await svcRef.current.startListening();
      setStatus("listening");
      setListening(true);
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
    try { svcRef.current?.stopListening(); } catch {}
    setListening(false);
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setInterim("");
    setFinal("");
    setLastAnswer("");
  }, []);

  const setContinuous = useCallback((v: boolean) => {
    try { svcRef.current?.setContinuous?.(v); } catch {}
  }, []);

  return useMemo(() => ({
    listening,
    status,
    interimTranscript,
    finalTranscript,
    lastAnswer,
    start,
    startWithPrefix,
    stop,
    reset,
    setContinuous,
  }), [listening, status, interimTranscript, finalTranscript, lastAnswer, start, startWithPrefix, stop, reset, setContinuous]);
}
