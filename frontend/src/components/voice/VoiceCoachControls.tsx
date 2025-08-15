// VoiceCoachControls.tsx — SAFE version (no conditional hooks)
import { useState, useCallback } from "react";
import { useVoiceCoach, type VoiceCoachOptions } from "@/voice/useVoiceCoach";

type Props = VoiceCoachOptions & { className?: string };

export default function VoiceCoachControls(props: Props) {
  const vc = useVoiceCoach(props);                // stable hook order
  const [open, setOpen] = useState(false);

  const onStart  = useCallback(() => vc.startVoiceCoach(), [vc]);
  const onStop   = useCallback(() => vc.stopVoiceCoach(), [vc]);
  const onListen = useCallback(() => vc.startListening(), [vc]);
  const onStopL  = useCallback(() => vc.stopListening(), [vc]);

  if (!vc.isSupported) return null;

  return (
    <div className={props.className ?? "rounded-2xl border p-3 shadow-sm"}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">Voice Coach</div>
        <button className="px-2 py-1 rounded-lg border" onClick={() => setOpen(v => !v)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            {!vc.isActive
              ? <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={onStart}>Start</button>
              : <button className="px-3 py-1 rounded bg-gray-200" onClick={onStop}>Stop</button>}
            {!vc.isListening
              ? <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={onListen}>Listen</button>
              : <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={onStopL}>Stop Listening</button>}
            <button className="px-3 py-1 rounded border" onClick={vc.previousStep}>Prev</button>
            <button className="px-3 py-1 rounded border" onClick={vc.repeatStep}>Repeat</button>
            <button className="px-3 py-1 rounded border" onClick={vc.nextStep}>Next</button>
            <button className="px-3 py-1 rounded border" onClick={vc.currentStepInfo}>Where am I?</button>
          </div>

          {!!vc.toast && <div className="text-sm text-gray-700">{vc.toast}</div>}
          {!!vc.error && <div className="text-sm text-red-600">Error: {vc.error}</div>}
          {!!vc.partialTranscript && <div className="text-sm text-gray-500">…{vc.partialTranscript}</div>}
          {!!vc.transcript && <div className="text-sm text-gray-900">You said: "{vc.transcript}"</div>}
        </div>
      )}
    </div>
  );
}
