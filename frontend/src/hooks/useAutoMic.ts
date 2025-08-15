import { useEffect, useRef, useState } from "react";

type AutoMicOpts = {
  shouldStart: boolean;                 // e.g. stepsReady && qs flag
  onChunk?: (blob: Blob) => void;       // where to send audio
  onStart?: () => void;
  onStop?: () => void;
  onError?: (e: any) => void;
};

export function useAutoMic({ shouldStart, onChunk, onStart, onStop, onError }: AutoMicOpts) {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [isRecording, setRecording] = useState(false);

  useEffect(() => {
    if (!shouldStart) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recRef.current = rec;

        rec.onstart = () => { setRecording(true); onStart?.(); };
        rec.onstop  = () => { setRecording(false); onStop?.(); };
        rec.ondataavailable = e => { if (e.data?.size && onChunk) onChunk(e.data); };

        // small chunks every 250ms
        rec.start(250);
      } catch (e: any) {
        // User denied or browser demands gesture → show fallback
        if (e?.name === "NotAllowedError" || String(e?.message).includes("gesture")) {
          setNeedsUserGesture(true);
        } else {
          onError?.(e);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { recRef.current?.stop(); } catch {}
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      recRef.current = null;
      streamRef.current = null;
      setRecording(false);
    };
  }, [shouldStart]);

  const startWithGesture = async () => {
    setNeedsUserGesture(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recRef.current = rec;
      rec.onstart = () => { setRecording(true); onStart?.(); };
      rec.onstop  = () => { setRecording(false); onStop?.(); };
      rec.ondataavailable = e => { if (e.data?.size && onChunk) onChunk(e.data); };
      rec.start(250);
    } catch (e) {
      onError?.(e);
    }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch {}
  };

  return { needsUserGesture, startWithGesture, isRecording, stop };
}
