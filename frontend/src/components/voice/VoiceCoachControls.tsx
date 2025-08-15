// frontend/src/components/voice/VoiceCoachControls.tsx
// 
// USAGE EXAMPLE (when VITE_ENABLE_VOICE_COACH=true):
// const VC_ENABLED = import.meta.env.VITE_ENABLE_VOICE_COACH === "true";
// {VC_ENABLED ? <VoiceCoachControls ... /> : null}
//
export default function VoiceCoachControls() {
  const VC_ENABLED = import.meta.env.VITE_ENABLE_VOICE_COACH === "true";
  
  if (!VC_ENABLED) {
    console.log("[VC-STUB] voice/VoiceCoachControls disabled by VITE_ENABLE_VOICE_COACH flag");
    return null;
  }
  
  console.log("[VC-STUB] voice/VoiceCoachControls stub loaded");
  return null;
}
export { default as VoiceCoachControls } from "./VoiceCoachControls";
