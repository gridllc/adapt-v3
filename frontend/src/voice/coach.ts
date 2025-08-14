import { Intent } from './intents';

export interface Step {
  id: string;
  start: number;   // seconds
  end: number;     // seconds
  title: string;
  description: string;
  notes?: string;
}

export interface VoiceContext {
  steps: Step[];
  current: number;                   // 0-based index
  seekTo: (sec: number) => void;
  speak: (msg: string) => void;      // non-blocking TTS
  pause: () => void;
  play: () => void;
  setCurrent: (i: number) => void;
  getCurrentTime?: () => number;
  mute?: () => void;
  unmute?: () => void;
}

const REPEAT_REWIND_S = 1.0;         // small rewind for "repeat"
const SUMMARY_CHUNK_LEN = 240;       // rough characters per TTS chunk
const MAX_SUMMARY_STEPS = 12;        // avoid reading 50 steps at once

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeStepAt(steps: Step[], i: number): Step | undefined {
  if (!Array.isArray(steps) || steps.length === 0) return undefined;
  if (i < 0 || i >= steps.length) return undefined;
  return steps[i];
}

function titleOrSnippet(s: Step) {
  const t = s.title?.trim();
  if (t) return t;
  // first sentence of text as fallback
  const first = (s.description || '').split(/(?<=[.!?])\s+/)[0]?.trim();
  return first || 'Step';
}

function speakInChunks(say: (m: string) => void, text: string) {
  // naive chunker to keep TTS stable
  let remaining = text.trim();
  while (remaining.length > SUMMARY_CHUNK_LEN) {
    const cut = remaining.lastIndexOf('. ', SUMMARY_CHUNK_LEN);
    const n = cut > 0 ? cut + 1 : SUMMARY_CHUNK_LEN;
    say(remaining.slice(0, n).trim());
    remaining = remaining.slice(n).trim();
  }
  if (remaining) say(remaining);
}

export function handleIntent(intent: Intent, ctx: VoiceContext) {
  const { steps } = ctx;

  const speakStep = (i: number, opts?: { announceNumber?: boolean }) => {
    const s = safeStepAt(steps, i);
    if (!s) return;
    const start = Math.max(0, s.start);
    ctx.seekTo(start);
    const prefix = opts?.announceNumber === false ? '' : `Step ${i + 1}. `;
    ctx.speak(`${prefix}${titleOrSnippet(s)}`);
  };

  // early outs for empty curriculum
  if (!steps || steps.length === 0) {
    if (intent.type === 'PAUSE') { ctx.pause(); }
    else if (intent.type === 'RESUME') { ctx.play(); }
    else ctx.speak('No steps are available yet.');
    return;
  }

  const current = clamp(ctx.current ?? 0, 0, steps.length - 1);

  switch (intent.type) {
    case 'NEXT': {
      const next = clamp(current + 1, 0, steps.length - 1);
      if (next === current) {
        ctx.speak("You're at the last step.");
      } else {
        ctx.setCurrent(next);
        speakStep(next);
      }
      break;
    }

    case 'PREV': {
      const prev = clamp(current - 1, 0, steps.length - 1);
      if (prev === current) {
        ctx.speak("You're at the first step.");
      } else {
        ctx.setCurrent(prev);
        speakStep(prev);
      }
      break;
    }

    case 'GOTO': {
      const i = clamp((intent.n ?? 0) - 1, 0, steps.length - 1);
      ctx.setCurrent(i);
      // confirmation helps when ASR mishears numbers
      ctx.speak(`Going to step ${i + 1}.`);
      speakStep(i, { announceNumber: false });
      break;
    }

    case 'WHICH': {
      ctx.speak(`You're on step ${current + 1} of ${steps.length}.`);
      break;
    }

    case 'REPEAT': {
      const s = safeStepAt(steps, current);
      if (!s) break;
      const rewound = Math.max(0, (s.start ?? 0) - REPEAT_REWIND_S);
      ctx.seekTo(rewound);
      speakStep(current);
      break;
    }

    case 'SUMMARY': {
      const cap = Math.min(steps.length, MAX_SUMMARY_STEPS);
      const items = steps.slice(0, cap).map((s, i) => `Step ${i + 1}: ${titleOrSnippet(s)}`);
      const text = items.join('. ');
      if (steps.length > cap) {
        speakInChunks(ctx.speak, text + `. Plus ${steps.length - cap} more steps.`);
      } else {
        speakInChunks(ctx.speak, text);
      }
      break;
    }

    case 'EXPLAIN': {
      const s = safeStepAt(steps, current);
      if (!s) break;
      if (s.notes?.trim()) {
        ctx.speak(s.notes.trim());
      } else {
        ctx.speak(titleOrSnippet(s)); // lightweight fallback explanation
      }
      break;
    }

    case 'PAUSE': {
      // Saying "Paused" often conflicts with pausing audio; prefer UI toast.
      // If you do want voice, speak first then pause:
      // ctx.speak('Paused.'); ctx.pause();
      ctx.pause();
      break;
    }

    case 'RESUME': {
      ctx.play();
      // Optional: no TTS here; resume media instead of talking over it.
      break;
    }

    case 'RESTART': {
      const firstStep = safeStepAt(steps, 0);
      if (firstStep) {
        ctx.setCurrent(0);
        ctx.seekTo(0);
        speakStep(0);
      }
      break;
    }

    case 'SEEK_REL': {
      const currentTime = ctx.getCurrentTime ? ctx.getCurrentTime() : 0;
      const newTime = Math.max(0, currentTime + intent.delta);
      ctx.seekTo(newTime);
      if (intent.delta > 0) {
        ctx.speak(`Skipped forward ${intent.delta} seconds.`);
      } else {
        ctx.speak(`Rewound ${Math.abs(intent.delta)} seconds.`);
      }
      break;
    }

    case 'HELP': {
      ctx.speak(`You can say: next step, previous step, go to step 3, repeat, pause, resume, summary, explain, or restart.`);
      break;
    }

    case 'MUTE': {
      if (ctx.mute) {
        ctx.mute();
        ctx.speak('Audio muted.');
      } else {
        ctx.speak('Mute not available.');
      }
      break;
    }

    case 'UNMUTE': {
      if (ctx.unmute) {
        ctx.unmute();
        ctx.speak('Audio unmuted.');
      } else {
        ctx.speak('Unmute not available.');
      }
      break;
    }
  }
}
