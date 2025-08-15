import { useEffect, useRef, useState } from "react";

type AutoMicOpts = {
  shouldStart: boolean;         // e.g. querystring voicestart=1 AND steps ready
  onChunk?: (blob: Blob) => void; // stream to /api/ai/transcribe-stream
  onStart?: () => void;
  onStop?: () => void;
  onError?: (err: any) => void;
};

export function useAutoMic({ shouldStart, onChunk, onStart, onStop, onError }: AutoMicOpts) {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);

  useEffect(() => {
    if (!shouldStart) return;
    let cancelled = false;

    (async () => {
      try {
        // if we primed on upload, this will resolve without prompting
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recRef.current = rec;

        rec.ondataavailable = (e) => { if (e.data.size && onChunk) onChunk(e.data); };
        rec.onstart = () => onStart?.();
        rec.onstop = () => onStop?.();

        // stream small chunks
        rec.start(250);
      } catch (e: any) {
        // NotAllowedError or gesture errors → show the one-tap fallback
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
    };
  }, [shouldStart]);

  // handler for the fallback button
  const startWithGesture = async () => {
    setNeedsUserGesture(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size && onChunk) onChunk(e.data); };
      rec.start(250);
      onStart?.();
    } catch (e) {
      onError?.(e);
    }
  };

  return { needsUserGesture, startWithGesture };
}
