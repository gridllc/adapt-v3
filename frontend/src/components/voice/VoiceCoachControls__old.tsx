// TEMP: universal stub (voice/VoiceCoachControls)
export interface VoiceCoachControlsProps {
  steps: any[]; currentStepIndex: number; onStepChange: (i: number) => void;
  onSeek: (t: number) => void; onPause: () => void; onPlay: () => void;
  getCurrentTime?: () => number; onMute?: () => void; onUnmute?: () => void;
  speechOptions?: any; pressToTalk?: boolean;
}
export default function VoiceCoachControls(_: VoiceCoachControlsProps) {
  console.log("[VC-STUB] voice/VoiceCoachControls stub loaded");
  return null;
}
export { VoiceCoachControls };
