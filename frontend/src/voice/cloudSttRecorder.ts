// voice/cloudSttRecorder.ts
export type SttResult = { transcript: string; confidence: number };

export class CloudSttRecorder {
  private mediaRecorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private stream?: MediaStream;
  private mime: string;

  constructor() {
    const prefer = [
      'audio/webm;codecs=opus',
      'audio/webm',
    ];
    this.mime = prefer.find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || 'audio/webm';
  }

  async start(): Promise<void> {
    // Must be called in a user gesture
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.mime });

    this.mediaRecorder.ondataavailable = (e) => e.data?.size && this.chunks.push(e.data);
    this.mediaRecorder.start();
  }

  async stopAndTranscribe(endpoint = '/api/stt/google'): Promise<SttResult> {
    if (!this.mediaRecorder) throw new Error('Recorder not started');

    await new Promise<void>((resolve) => {
      this.mediaRecorder!.onstop = () => resolve();
      this.mediaRecorder!.stop();
    });

    const blob = new Blob(this.chunks, { type: this.mime });
    this.stream?.getTracks().forEach(t => t.stop());

    const form = new FormData();
    form.append('audio', blob, 'clip.webm');

    const r = await fetch(endpoint, { method: 'POST', body: form, credentials: 'include' });
    if (!r.ok) throw new Error(`STT HTTP ${r.status}`);
    const data = await r.json();
    return { transcript: data.transcript || '', confidence: data.confidence ?? 0 };
  }
}
