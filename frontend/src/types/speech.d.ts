// Basic Web Speech types (enough for our use)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string } }[];
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (e: any) => void;
}

interface Window {
  webkitSpeechRecognition?: new () => SpeechRecognition;
  SpeechRecognition?: new () => SpeechRecognition;
}
