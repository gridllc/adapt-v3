export type PartialListener<T> = (data: T) => void;

export interface SpeechService {
  // speech-to-text
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  onResult(cb: PartialListener<string>): void;
  onError(cb: PartialListener<string>): void;
  isSttAvailable(): boolean;

  // text-to-speech
  speak(text: string): Promise<void>;
  cancelSpeak(): void;
  isTtsAvailable(): boolean;

  // clean up
  dispose(): void;
}
