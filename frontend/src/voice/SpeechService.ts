export type PartialListener<T> = (data: T) => void;

export interface SpeechService {
  // speech-to-text
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  onResult(cb: PartialListener<string>): void;
  onPartial(cb: PartialListener<string>): void; // Add support for interim results
  onError(cb: PartialListener<string>): void;
  isSttAvailable(): boolean;
  setContinuous(v: boolean): void; // Add support for continuous mode

  // text-to-speech
  speak(text: string): Promise<void>;
  cancelSpeak(): void;
  isTtsAvailable(): boolean;

  // clean up
  dispose(): void;
}
