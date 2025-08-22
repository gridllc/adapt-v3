import React from "react";
import { useVoiceAsk } from "../hooks/useVoiceAsk";

export default function VoiceAsk({ moduleId }: { moduleId: string }) {
  const sup = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  const supported = !!sup;

  const { listening, partial, finalText, answer, start, stop } = useVoiceAsk(moduleId);

  if (!supported) {
    return <div className="text-sm text-amber-700">🎤 Voice not supported on this browser.</div>;
  }

  const press = {
    onMouseDown: start, onMouseUp: stop,
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); start(); },
    onTouchEnd:   (e: React.TouchEvent) => { e.preventDefault(); stop(); },
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        {...press}
        className={`px-4 py-3 rounded-2xl text-white transition
                    ${listening ? "bg-red-600" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {listening ? "Listening… release to send" : "Hold to Talk"}
      </button>

      <div className="min-h-5 text-sm text-gray-600">
        {listening && partial && <>🗣️ {partial}</>}
        {!listening && finalText && <>✔️ {finalText}</>}
      </div>

      {answer && (
        <div className="text-sm bg-gray-50 border border-gray-200 rounded p-2">
          <span className="font-medium">AI:</span> {answer}
        </div>
      )}
    </div>
  );
}
