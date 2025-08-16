import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_ENDPOINT ?? "/api/upload";

export const UploadManager: React.FC = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function primeMic() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false; // we'll show a fallback button on Training page
    }
  }

  async function onChooseFile(file: File) {
    setBusy(true);
    // ask permission during the user gesture call stack
    primeMic().catch(() => {});
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
      const data = await res.json(); // { filename: moduleId, ... }
      navigate(`/training/${data.filename}?voicestart=1`);
    } catch (e: any) {
      alert(e?.message || "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChooseFile(f);
        }}
      />
      <button
        className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : "Upload a video"}
      </button>
      <p className="text-xs text-neutral-500">MP4/WEBM up to your plan limit.</p>
    </div>
  );
}
