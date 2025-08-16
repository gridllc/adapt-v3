import { useEffect, useRef, useState } from "react";

export function useAutoMic(shouldStart: boolean) {
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setRecording] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldStart) return;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        if (!("MediaRecorder" in window)) {
          setError("MediaRecorder not supported");
          return;
        }
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recRef.current = rec;
        rec.onstart = () => setRecording(true);
        rec.onstop = () => setRecording(false);
        rec.start(250);
      } catch (e: any) {
        if (e?.name === "NotAllowedError") setNeedsGesture(true);
        else setError(e?.message || String(e));
      }
    })();

    return () => {
      try { recRef.current?.stop(); } catch {}
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      recRef.current = null; streamRef.current = null;
      setRecording(false);
    };
  }, [shouldStart]);

  const startWithGesture = async () => {
    setNeedsGesture(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new (window as any).MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recRef.current = rec;
      rec.onstart = () => setRecording(true);
      rec.onstop = () => setRecording(false);
      rec.start(250);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return { isRecording, needsGesture, startWithGesture, error };
}
