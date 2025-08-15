// TEMP hotfix: disable Voice Coach overlay entirely
interface VoiceCoachOverlayProps {
  isVisible: boolean;
  onStart: () => void;
  onDismiss: () => void;
  dismissOnBackdropClick?: boolean;
}

export function VoiceCoachOverlay(props: VoiceCoachOverlayProps) {
  return null;
}
export default VoiceCoachOverlay;
