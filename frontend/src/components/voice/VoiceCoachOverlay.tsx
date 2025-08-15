// frontend/src/components/voice/VoiceCoachOverlay.tsx
// 
// USAGE EXAMPLE (when VITE_ENABLE_VOICE_COACH=true):
// const VC_ENABLED = import.meta.env.VITE_ENABLE_VOICE_COACH === "true";
// {VC_ENABLED ? <VoiceCoachOverlay ... /> : null}
//
export default function VoiceCoachOverlay() {
  const VC_ENABLED = import.meta.env.VITE_ENABLE_VOICE_COACH === "true";
  
  if (!VC_ENABLED) {
    console.log("[VC-STUB] voice/VoiceCoachOverlay disabled by VITE_ENABLE_VOICE_COACH flag");
    return null;
  }
  
  console.log("[VC-STUB] voice/VoiceCoachOverlay stub loaded");
  return null;
}
export { default as VoiceCoachOverlay } from "./VoiceCoachOverlay";
