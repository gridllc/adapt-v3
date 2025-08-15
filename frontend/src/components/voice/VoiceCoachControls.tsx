// TEMP hotfix: disable Voice Coach controls entirely
interface VoiceCoachControlsProps {
  steps: any[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onSeek: (time: number) => void;
  onPause: () => void;
  onPlay: () => void;
  getCurrentTime?: () => number;
  onMute?: () => void;
  onUnmute?: () => void;
  speechOptions?: any;
  pressToTalk?: boolean;
}

export default function VoiceCoachControls(props: VoiceCoachControlsProps) {
  return null;
}
export { VoiceCoachControls };
