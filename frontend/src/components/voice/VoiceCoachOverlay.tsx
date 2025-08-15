// TEMP: universal stub (voice/VoiceCoachOverlay)
export interface VoiceCoachOverlayProps {
  isVisible: boolean;
  onStart: () => void;
  onDismiss: () => void;
  dismissOnBackdropClick?: boolean;
}

export default function VoiceCoachOverlay(_: VoiceCoachOverlayProps) {
  console.log("[VC-STUB] VoiceCoachOverlay stub loaded");
  return null;
}
export { VoiceCoachOverlay };
