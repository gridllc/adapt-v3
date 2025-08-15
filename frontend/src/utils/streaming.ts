export type StreamMode = 'text' | 'sse';

export interface StreamOptions {
  url: string;
  body?: any;
  token?: string | null;
  mode?: StreamMode;                 // 'text' = raw lines, 'sse' = Server-Sent Events
  onDelta: (text: string) => void;   // called for each chunk/line
  onDone?: () => void;
  onError?: (err: unknown) => void;
  signal?: AbortSignal;
  timeoutMs?: number;                // optional overall timeout
}

export async function streamText({
  url, body, token, mode = 'text', onDelta, onDone, onError, signal, timeoutMs
}: StreamOptions) {
  // Abort: timeout + external signal (mobile-friendly)
  const controller = new AbortController();
  const timers: number[] = [];
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  if (timeoutMs && timeoutMs > 0) {
    const t = window.setTimeout(() => controller.abort(), timeoutMs);
    timers.push(t);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // iOS/Safari: keepalive helps with backgrounding; harmless elsewhere
      keepalive: true,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error('No response body to stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (mode === 'sse') {
        // Consume complete SSE events (double newline delimited)
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // Extract "data: ..."
          for (const line of event.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              onDelta(trimmed.slice(5).trim());
            }
          }
        }
      } else {
        // Plain text line framing
        let lastNL = buffer.lastIndexOf('\n');
        if (lastNL >= 0) {
          const emit = buffer.slice(0, lastNL);
          buffer = buffer.slice(lastNL + 1);
          for (const line of emit.split('\n')) {
            if (line) onDelta(line);
          }
        }
      }
    }

    // Flush any remainder
    if (buffer) onDelta(buffer);
    onDone?.();
  } catch (err) {
    // Swallow AbortError as a normal stop
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      onError?.(err);
    }
  } finally {
    timers.forEach(clearTimeout);
  }
}
