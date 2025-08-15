import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useVoiceCoach, VoiceCoachOptions } from '../../voice/useVoiceCoach';
import { MicDiagnostics } from './MicDiagnostics';

type Step = {
  id: string;
  start: number;
  end: number;
  title: string;
  description: string;
  notes?: string;
};

type SpeechOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: string;
  lang?: string;
  // add more if your hook supports them
};

interface VoiceCoachControlsProps {
  steps: Step[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onSeek: (time: number) => void;
  onPause: () => void;
  onPlay: () => void;
  getCurrentTime?: () => number;
  onMute?: () => void;
  onUnmute?: () => void;
  speechOptions?: SpeechOptions;
  pressToTalk?: boolean; // optional: hold-to-talk UX
}

export const VoiceCoachControls: React.FC<VoiceCoachControlsProps> = ({
  steps,
  currentStepIndex,
  onStepChange,
  onSeek,
  onPause,
  onPlay,
  getCurrentTime,
  onMute,
  onUnmute,
  speechOptions,
  pressToTalk = false,
}) => {
  const voiceOptions: VoiceCoachOptions = {
    steps,
    currentIndex: currentStepIndex,
    onStepChange,
    onSeek,
    onPause,
    onPlay,
    getCurrentTime,
    onMute,
    onUnmute,
    speechOptions,
  };

  const {
    isActive,
    isListening,
    isSupported,
    transcript,
    partialTranscript,
    error,
    lastIntent,
    confidenceLevel,
    disambiguationPrompt,
    isSpeaking,
    startVoiceCoach,
    stopVoiceCoach,
    startListening,
    stopListening,
    nextStep,
    previousStep,
    repeatStep,
    currentStepInfo,
    clearDisambiguation,
    toast,
  } = useVoiceCoach(voiceOptions);

  // Track muted state
  const [isMuted, setIsMuted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  if (!isSupported) return null;

  // Hotkeys when voice coach is active and focused
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ignore when focused on inputs/textareas/contenteditable
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || el?.isContentEditable;
      if (isTyping) return;

      if (!rootRef.current?.contains(el)) return;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousStep();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          repeatStep();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, previousStep, repeatStep]);

  // Listen for voice coach start event from overlay
  useEffect(() => {
    const handler = () => {
      // prevent double-start while TTS may be speaking
      if (!isActive && !isSpeaking) {
        startVoiceCoach();
      }
    };
    window.addEventListener('vc-start', handler);
    return () => window.removeEventListener('vc-start', handler);
  }, [isActive, isSpeaking, startVoiceCoach]);

  // Haptic feedback on permission errors
  useEffect(() => {
    if (error && 'vibrate' in navigator) {
      (navigator as any).vibrate?.(60);
    }
  }, [error]);

  const progressPct = useMemo(() => {
    if (!steps?.length) return 0;
    const pct = ((currentStepIndex + 1) / steps.length) * 100;
    return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  }, [steps?.length, currentStepIndex]);

  const confidencePct = useMemo(() => {
    const raw = (lastIntent?.confidence ?? 0) * 100;
    return Math.max(0, Math.min(100, raw)).toFixed(0);
  }, [lastIntent?.confidence]);

  const getConfidenceColor = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const handleRestart = useCallback(() => onSeek(0), [onSeek]);

  // User gesture probe to test if we're within a valid user gesture context
  const userGestureProbe = useCallback(() => {
    try {
      // If this throws synchronously on iOS, you're outside a gesture
      // (WebKit can be picky depending on call stacks and awaiting).
      // This call won't prompt but may reveal "InvalidStateError".
      // @ts-ignore
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) { 
        const rec = new SR(); 
        rec.lang = "en-US"; 
        rec.start(); 
        rec.stop(); 
      }
      console.log("[VC] gesture probe executed inside click handler");
      return true;
    } catch (e) {
      console.log("[VC] gesture probe failed:", (e as Error).message);
      return false;
    }
  }, []);

  const permissionHelp =
    error && /NOT_ALLOWED|SERVICE_NOT_ALLOWED|AUDIO_CAPTURE/i.test(error)
      ? ' Microphone permission may be blocked. Check site permissions and input device.'
      : '';

  const handleMuteToggle = useCallback(() => {
    if (isMuted) {
      onUnmute?.();
      setIsMuted(false);
    } else {
      onMute?.();
      setIsMuted(true);
    }
  }, [isMuted, onMute, onUnmute]);

  // Unified PTT handlers with pointer events
  const handlePTTDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (!isSpeaking) {
      const gestureOk = userGestureProbe();
      if (gestureOk) {
        startListening();
      } else {
        console.warn("[VC] Gesture probe failed for PTT down");
        startListening(); // Still try
      }
    }
  }, [isSpeaking, startListening, userGestureProbe]);

  const handlePTTUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    stopListening();
  }, [stopListening]);

  return (
    <div className="space-y-4" data-testid="voice-coach" ref={rootRef} aria-busy={isListening}>
      {/* Step Progress */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Step {Math.min(currentStepIndex + 1, Math.max(steps.length, 1))} of {steps.length || 0}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Timeline</span>
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden" aria-label="Step progress">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Primary Control Row */}
      <div className="flex items-center gap-3">
        {/* Voice Coach Toggle */}
        <button
          type="button"
          onClick={() => {
            if (isActive) {
              stopVoiceCoach();
            } else {
              // Run gesture probe first to diagnose issues
              const gestureOk = userGestureProbe();
              if (gestureOk) {
                startVoiceCoach();
              } else {
                console.warn("[VC] Gesture probe failed - voice coach may not work");
                // Still try to start, but log the warning
                startVoiceCoach();
              }
            }
          }}
          aria-pressed={isActive}
          className={`flex-1 py-3 px-4 rounded-full font-medium transition-all ${
            isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="text-lg mr-2" aria-hidden>
            {isActive && isMuted ? '🔇' : '🎤'}
          </span>
          {isActive ? (isMuted ? 'Voice Coach ON (Muted)' : 'Voice Coach ON') : 'Voice Coach'}
        </button>

        {/* Next Step */}
        <button
          type="button"
          onClick={nextStep}
          disabled={currentStepIndex >= steps.length - 1 || isSpeaking}
          className="px-4 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next step"
        >
          ⏭
        </button>

        {/* Repeat */}
        <button
          type="button"
          onClick={repeatStep}
          disabled={isSpeaking}
          className="px-4 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Repeat current step"
        >
          🔁
        </button>

        {/* Mic Diagnostics */}
        <MicDiagnostics />
      </div>

      {/* Voice Coach Status */}
      {isActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}
                aria-label={isListening ? 'Listening' : 'Idle'}
              />
              <span className="text-sm font-medium text-blue-800">
                {pressToTalk ? (isListening ? 'Hold to talk…' : 'Press and hold to talk') : isListening ? 'Listening…' : 'Tap to speak'}
              </span>
              {isSpeaking && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-xs text-blue-600">Speaking</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {pressToTalk ? (
                <button
                  type="button"
                  disabled={isSpeaking}
                  onPointerDown={handlePTTDown}
                  onPointerUp={handlePTTUp}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hold to Speak
                </button>
              ) : isListening ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded-full hover:bg-red-700 transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const gestureOk = userGestureProbe();
                    if (gestureOk) {
                      startListening();
                    } else {
                      console.warn("[VC] Gesture probe failed for Speak button");
                      startListening(); // Still try
                    }
                  }}
                  disabled={isSpeaking}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Speak
                </button>
              )}

              <button
                type="button"
                onClick={stopVoiceCoach}
                className="px-3 py-1 bg-gray-600 text-white text-xs rounded-full hover:bg-gray-700 transition-colors"
              >
                Close
              </button>

              {/* Mute/Unmute button */}
              {(onMute || onUnmute) && (
                <button
                  type="button"
                  onClick={handleMuteToggle}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isMuted
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={isMuted ? 'Unmute audio' : 'Mute audio'}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              )}
            </div>
          </div>

          {/* Partial Transcript (Live Caption) */}
          {partialTranscript && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded" aria-live="polite">
              <p className="text-xs text-yellow-700 mb-1">Listening…</p>
              <p className="text-sm text-yellow-800 italic">"{partialTranscript}"</p>
            </div>
          )}

          {/* Thinking indicator - shows when listening stops but no intent yet */}
          {!isListening && isActive && !lastIntent && !partialTranscript && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-xs text-blue-700">Processing...</span>
              </div>
            </div>
          )}

          {/* Confidence Indicator */}
          {lastIntent && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-white rounded border border-blue-200">
              <div className={`w-3 h-3 rounded-full ${getConfidenceColor(confidenceLevel)}`} />
              <span className="text-xs text-gray-600">
                Confidence: {confidenceLevel} ({confidencePct}%)
              </span>
              {lastIntent.matched && (
                <span className="text-xs text-blue-600 ml-2">
                  Matched: "{lastIntent.matched}"
                </span>
              )}
            </div>
          )}

          {/* Disambiguation Prompt + helpers */}
          {disambiguationPrompt && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800 mb-2">{disambiguationPrompt}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearDisambiguation}
                  className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-full hover:bg-yellow-700 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isSpeaking}
                  className="px-3 py-1 bg-white border border-yellow-300 text-yellow-700 text-xs rounded-full hover:bg-yellow-50 transition-colors disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={repeatStep}
                  disabled={isSpeaking}
                  className="px-3 py-1 bg-white border border-yellow-300 text-yellow-700 text-xs rounded-full hover:bg-yellow-50 transition-colors disabled:opacity-50"
                >
                  Repeat
                </button>
                <button
                  type="button"
                  onClick={currentStepInfo}
                  disabled={isSpeaking}
                  className="px-3 py-1 bg-white border border-yellow-300 text-yellow-700 text-xs rounded-full hover:bg-yellow-50 transition-colors disabled:opacity-50"
                >
                  Which step?
                </button>
              </div>
            </div>
          )}

          {/* Toast Messages */}
          {toast && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded" aria-live="polite">
              <p className="text-xs text-green-700 mb-1">System:</p>
              <p className="text-sm text-green-800">{toast}</p>
            </div>
          )}

          {/* Final Transcript + Intent */}
          {(transcript || lastIntent) && (
            <div className="mt-3 p-2 bg-white rounded border border-blue-200" aria-live="polite">
              {transcript && (
                <>
                  <p className="text-xs text-gray-600 mb-1">You said:</p>
                  <p className="text-sm text-gray-800">{transcript}</p>
                </>
              )}
              {lastIntent && (
                <p className="text-xs text-blue-600 mt-1">
                  Intent: {lastIntent.type} {lastIntent.n ? `(${lastIntent.n})` : ''}
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs text-red-600">
                {error}.{permissionHelp}
              </p>
            </div>
          )}

          {/* Quick Action Chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={nextStep}
              disabled={isSpeaking}
              className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Next
            </button>
            <button
              type="button"
              onClick={repeatStep}
              disabled={isSpeaking}
              className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Repeat
            </button>
            <button
              type="button"
              onClick={currentStepInfo}
              disabled={isSpeaking}
              className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Which step?
            </button>
            <button
              type="button"
              onClick={handleRestart}
              disabled={isSpeaking}
              className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
