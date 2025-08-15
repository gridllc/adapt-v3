import React from "react";

export const MicDiagnostics: React.FC = () => {
  const run = async () => {
    const log: string[] = [];
    const ts = () => new Date().toISOString().slice(11, 23);

    const push = (k: string, v: any) => log.push(`[${ts()}] ${k}: ${v}`);

    // Environment
    push("protocol", location.protocol);
    push("isSecureContext", String(window.isSecureContext));
    push("userAgent", navigator.userAgent);

    // Permissions (may not exist on iOS Safari; handle safely)
    try {
      // @ts-ignore
      if (navigator.permissions?.query) {
        // @ts-ignore
        const p = await navigator.permissions.query({ name: "microphone" as any });
        push("permissions.microphone.state", p.state);
      } else {
        push("permissions.microphone.state", "unsupported");
      }
    } catch (e) {
      push("permissions.microphone.error", (e as Error).message);
    }

    // Feature detection
    // @ts-ignore
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition);
    push("SpeechRecognition.available", !!SR);
    push("speechSynthesis.available", "speechSynthesis" in window);

    // getUserMedia sanity (prime or reveal OS/perm errors)
    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      push("getUserMedia", "success");
      stream?.getTracks()?.forEach(t => t.stop());
    } catch (e) {
      const err = e as DOMException;
      push("getUserMedia", `error:${err?.name || "unknown"} msg:${err?.message}`);
    }

    // Try to start recognition minimally (if present)
    if (SR) {
      try {
        const rec: any = new SR();
        rec.lang = "en-US";
        rec.interimResults = false;
        rec.continuous = false;

        let started = false;
        let ended = false;
        let errored: any = null;

        rec.onstart = () => { started = true; push("recognition.onstart", "fired"); };
        rec.onend = () => { ended = true; push("recognition.onend", "fired"); };
        rec.onerror = (ev: any) => { errored = ev?.error; push("recognition.onerror", ev?.error || "unknown"); };
        rec.onresult = (ev: any) => {
          const r = ev?.results?.[0]?.[0];
          push("recognition.onresult", r ? `${r.transcript} (${r.confidence})` : "no result");
        };

        // Watchdog if onstart never fires
        const watchdog = setTimeout(() => {
          if (!started) push("recognition.watchdog", "onstart not fired (likely user-gesture/permissions)");
          try { rec.stop(); } catch {}
        }, 3000);

        try { rec.start(); push("recognition.start()", "called"); } catch (e) {
          push("recognition.start()", `threw: ${(e as Error).message}`);
        }

        // wait a bit to capture events
        await new Promise(r => setTimeout(r, 3500));
        clearTimeout(watchdog);

        push("recognition.summary", JSON.stringify({ started, ended, errored }));
      } catch (e) {
        push("recognition.create", `threw: ${(e as Error).message}`);
      }
    }

    // TTS "unlock" probe
    try {
      const u = new SpeechSynthesisUtterance("Voice check");
      let ok = false;
      u.onstart = () => { ok = true; push("tts.onstart", "fired"); };
      u.onend = () => { push("tts.onend", "fired"); };
      window.speechSynthesis?.speak(u);
      await new Promise(r => setTimeout(r, 1200));
      push("tts.summary", ok ? "spoke" : "no onstart");
    } catch (e) {
      push("tts", `error: ${(e as Error).message}`);
    }

    // Print once
    console.log("%c[VC DIAG]", "background:#0ea5e9;color:#fff;padding:2px 6px;border-radius:4px", "\n" + log.join("\n"));
    alert("Mic diagnostics complete. Open the console to view details.");
  };

  return (
    <button
      type="button"
      onClick={run}
      className="px-3 py-1 text-xs rounded-full bg-gray-100 hover:bg-gray-200"
      title="Run voice/mic diagnostics"
    >
      🧪 Mic Diagnostics
    </button>
  );
};
