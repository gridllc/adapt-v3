// src/components/StickyVoiceBar.tsx
import React from "react";
import type { VoiceController } from "../hooks/useVoiceAsk";

type Props = {
  controller: VoiceController;
};

export default function StickyVoiceBar({ controller }: Props) {
  const {
    listening,
    status,
    interimTranscript,
    finalTranscript,
    lastAnswer,
    start,
    stop,
    reset,
    setContinuous,
  } = controller;

  const color =
    status === "listening" ? "bg-green-600" :
    status === "denied" ? "bg-red-600" :
    status === "unsupported" ? "bg-amber-600" :
    status === "error" ? "bg-red-600" :
    "bg-slate-700";

  const statusText =
    status === "listening" ? "Listening…" :
    status === "denied" ? "Mic permission denied" :
    status === "unsupported" ? "Voice unsupported in this browser" :
    status === "error" ? "Mic error" :
    "Idle";

  return (
    <div className="sticky top-2 z-30">
      <div className={`rounded-2xl shadow-md ${color} text-white px-4 py-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between">
          <div className="font-medium">{statusText}</div>
          <div className="flex items-center gap-2">
            <label className="text-xs opacity-80 flex items-center gap-1">
              <input
                type="checkbox"
                className="accent-white"
                defaultChecked
                onChange={(e) => setContinuous(e.target.checked)}
                title="Keep listening continuously"
              />
              Continuous
            </label>
            {!listening ? (
              <button
                onClick={start}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
                title="Start Training (mic)"
              >
                Start Training
              </button>
            ) : (
              <button
                onClick={stop}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
                title="Stop"
              >
                Stop
              </button>
            )}
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
              title="Clear text"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Live transcript */}
        <div className="text-sm">
          <div className="opacity-80">
            {interimTranscript ? (
              <span className="italic opacity-90">{interimTranscript}</span>
            ) : finalTranscript ? (
              <span>{finalTranscript}</span>
            ) : (
              <span className="opacity-60">Say: "What's step one?"</span>
            )}
          </div>
        </div>

        {/* Last AI answer */}
        {lastAnswer && (
          <div className="text-xs bg-white/10 rounded-lg p-2 leading-relaxed">
            <div className="opacity-80">AI:</div>
            <div>{lastAnswer}</div>
          </div>
        )}
      </div>
    </div>
  );
}