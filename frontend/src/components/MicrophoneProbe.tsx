import {useEffect, useRef, useState} from "react";

export default function MicrophoneProbe() {
  const [perm, setPerm] = useState<string>("?");
  const [supportsMR, setSupportsMR] = useState<boolean>(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [recording, setRecording] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chunks, setChunks] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start(recNeedsGesture = false) {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      if (!("MediaRecorder" in window)) {
        setErr("MediaRecorder not supported (Safari < 14.3 / old iOS).");
        return;
      }

      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recRef.current = rec;

      rec.onstart = () => setRecording(true);
      rec.onstop  = () => setRecording(false);
      rec.ondataavailable = e => {
        if (e.data && e.data.size) setChunks(c => c + 1);
      };

      rec.start(250); // proof-of-life chunks
      setNeedsGesture(false);
    } catch (e: any) {
      setRecording(false);
      // Most common: NotAllowedError until user clicks a button
      if (e?.name === "NotAllowedError") {
        setNeedsGesture(true);
      } else {
        setErr(`${e?.name || "Error"}: ${e?.message || e}`);
      }
    }
  }

  function stop() {
    try { recRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    recRef.current = null;
    streamRef.current = null;
  }

  useEffect(() => {
    setSupportsMR("MediaRecorder" in window);
    (async () => {
      try {
        const p: any = await (navigator as any).permissions?.query({ name: "microphone" as PermissionName });
        if (p?.state) setPerm(p.state);
      } catch {}
    })();

    // Try automatically once
    start();

    return stop;
  }, []);

  return (
    <div style={{
      position: "fixed", right: 16, bottom: 16, zIndex: 9999,
      background: "#111", color: "#fff", padding: "10px 12px",
      borderRadius: 10, fontSize: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.35)"
    }}>
      <div><b>Mic Probe</b></div>
      <div>perm: {perm ?? "?"} | MediaRecorder: {supportsMR ? "yes" : "no"}</div>
      <div>{recording ? "🎤 recording…" : "🔇 idle"} | chunks: {chunks}</div>
      {err && <div style={{color:"#ffb3b3"}}>{err}</div>}
      <div style={{display:"flex", gap:8, marginTop:8}}>
        <button onClick={() => start(true)} style={{padding:"6px 10px"}}>Enable Mic</button>
        <button onClick={stop} style={{padding:"6px 10px"}}>Stop</button>
      </div>
      {needsGesture && <div style={{marginTop:6}}>Tap "Enable Mic" once.</div>}
    </div>
  );
}
