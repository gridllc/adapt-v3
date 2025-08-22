import React from "react";
import { Mic, StopCircle, AlertCircle } from "lucide-react";
import type { VoiceController } from "@/hooks/useVoiceAsk";

export default function StickyVoiceBar({ controller }: { controller: VoiceController }) {
  const { listening, partial, finalText, start, stop, error } = controller;

  const press = {
    onMouseDown: start, 
    onMouseUp: stop,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); start(); },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); stop(); },
  };

  return (
    <div
      className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b
                 pt-[env(safe-area-inset-top)]"
      aria-label="Voice Assistant"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3">
        <button
          {...press}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-white
                     transition shadow-sm
                     ${listening ? "bg-red-600" : "bg-blue-600 hover:bg-blue-700"}
                     w-full sm:w-auto`}
          aria-pressed={listening}
        >
          {listening ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          <span className="font-medium">
            {listening ? "Listening… release to send" : "Hold to Talk"}
          </span>
        </button>

        {/* transcript/answer line (truncate for cleanliness) */}
        <div className="hidden sm:block flex-1 min-w-0 text-sm text-gray-600">
          <div className="truncate">
            {listening && partial && <>🗣️ {partial}</>}
            {!listening && finalText && <>✔️ {finalText}</>}
          </div>
        </div>
      </div>

      {/* Permission / error hint */}
      {error && (
        <div className="bg-amber-50 border-t border-amber-200 text-amber-800">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
