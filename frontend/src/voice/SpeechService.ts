export type PartialListener<T> = (data: T) => void;

export interface SpeechServiceOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoRestart?: boolean;
  maxListenMs?: number;
  preferredVoices?: string[];
  suspendSttWhileTts?: boolean;
}

export interface SpeechService {
  // speech-to-text
  startListening(
    onResult?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>,
    onError?: PartialListener<{ error: string; message: string; raw?: any }>,
    onEnd?: PartialListener<void>,
    onPartial?: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>
  ): Promise<boolean>;
  stopListening(): Promise<void>;
  stopSpeaking(): Promise<void>;
  onResult(cb: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>): void;
  onError(cb: PartialListener<{ error: string; message: string; raw?: any }>): void;
  onEnd(cb: PartialListener<void>): void;
  onPartial(cb: PartialListener<{ transcript: string; confidence: number; isFinal?: boolean }>): void;
  isSttAvailable(): boolean;

  // text-to-speech
  speak(text: string, options?: { resumeSttAfter?: boolean }): Promise<void>;
  cancelSpeak(): void;
  isTtsAvailable(): boolean;

  // additional methods
  setLanguage(lang: string): void;
  getVoices(): Promise<SpeechSynthesisVoice[]>;

  // clean up
  destroy(): void;
}
