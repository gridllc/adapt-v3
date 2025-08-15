import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserSpeechService, SpeechServiceOptions } from './browserSpeech';
import { parseIntent, shouldExecuteIntent, getDisambiguationPrompt, getConfidenceLevel } from './intents';
import { handleIntent, VoiceContext } from './coach';
import { CloudSttRecorder } from './cloudSttRecorder';
import { ENABLE_GOOGLE_VOICE, VOICE_FALLBACK_TO_GOOGLE } from '../config/app';

export interface VoiceCoachOptions {
  steps: any[];
  currentIndex: number;
  onStepChange: (index: number) => void;
  onSeek: (time: number) => void;
  onPause: () => void;
  onPlay: () => void;
  getCurrentTime?: () => number;
  onMute?: () => void;
  onUnmute?: () => void;
  speechOptions?: SpeechServiceOptions;
}

export interface VoiceCoachState {
  isActive: boolean;
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  partialTranscript: string;
  error: string | null;
  lastIntent: any | null;
  confidenceLevel: 'high' | 'medium' | 'low';
  disambiguationPrompt: string | null;
  isSpeaking: boolean;
  toast: string | null;
  mode: 'webspeech' | 'cloud';
}

export function useVoiceCoach(options: VoiceCoachOptions) {
  const [state, setState] = useState<VoiceCoachState>({
    isActive: false,
    isListening: false,
    isSupported: false,
    transcript: '',
    partialTranscript: '',
    error: null,
    lastIntent: null,
    confidenceLevel: 'low',
    disambiguationPrompt: null,
    isSpeaking: false,
    toast: null,
    mode: 'webspeech',
  });

  const speechService = useRef<BrowserSpeechService | null>(null);
  const cloudRecorderRef = useRef<CloudSttRecorder | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect capabilities and choose mode
  useEffect(() => {
    const hasWebSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasMediaRecorder = 'MediaRecorder' in window && navigator.mediaDevices?.getUserMedia;
    
    // Determine mode: Web Speech first, Google Cloud STT as fallback only when enabled
    let mode: 'webspeech' | 'cloud';
    
    if (hasWebSpeech) {
      // Web Speech available - use it as primary
      mode = 'webspeech';
      console.log('[Voice Coach] Using Web Speech mode (browser native)');
    } else if (hasMediaRecorder && ENABLE_GOOGLE_VOICE && VOICE_FALLBACK_TO_GOOGLE) {
      // Web Speech not available, but Google Cloud STT is enabled as fallback
      mode = 'cloud';
      console.log('[Voice Coach] Using Cloud STT mode (Web Speech unavailable, Google fallback enabled)');
    } else if (hasMediaRecorder) {
      // Web Speech not available, but MediaRecorder is - use Cloud STT if enabled
      mode = ENABLE_GOOGLE_VOICE ? 'cloud' : 'webspeech';
      console.log(`[Voice Coach] Web Speech unavailable, using ${mode} mode`);
    } else {
      // No voice support available
      mode = 'webspeech';
      console.log('[Voice Coach] No voice support available');
    }
    
    if (mode === 'webspeech' && hasWebSpeech) {
      // Initialize Web Speech service
      const speechOpts: SpeechServiceOptions = {
        lang: 'en-US',
        continuous: false,
        interimResults: true,
        autoRestart: true,
        maxListenMs: 15000,
        preferredVoices: ['Google', 'Natural', 'Microsoft'],
        suspendSttWhileTts: true,
        ...options.speechOptions,
      };
      
      speechService.current = new BrowserSpeechService(speechOpts);
      setState(prev => ({ 
        ...prev, 
        isSupported: speechService.current?.isSupported() || false,
        mode: 'webspeech'
      }));
    } else if (mode === 'cloud' && hasMediaRecorder && ENABLE_GOOGLE_VOICE) {
      // Initialize Cloud STT recorder (only when explicitly enabled)
      cloudRecorderRef.current = new CloudSttRecorder();
      setState(prev => ({ 
        ...prev, 
        isSupported: true,
        mode: 'cloud'
      }));
    } else {
      // No voice support available
      setState(prev => ({ 
        ...prev, 
        isSupported: false,
        mode: 'webspeech'
      }));
    }
  }, [options.speechOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechService.current) {
        speechService.current.destroy();
      }
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
      }
    };
  }, []);

  // Show toast message
  const showToast = useCallback((message: string, duration = 3000) => {
    // Clear existing timeout
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    // Set new timeout
    toastTimeout.current = setTimeout(() => {
      setState(prev => ({ ...prev, toast: null, partialTranscript: '' }));
    }, duration);

    setState(prev => ({ ...prev, toast: message }));
  }, []);

  // Speak text and show toast
  const speak = useCallback(async (text: string, options?: { resumeSttAfter?: boolean }) => {
    if (speechService.current) {
      setState(prev => ({ ...prev, isSpeaking: true }));
      
      try {
        await speechService.current.speak(text, {
          resumeSttAfter: options?.resumeSttAfter,
        });
        showToast(text);
      } finally {
        setState(prev => ({ ...prev, isSpeaking: false }));
      }
    }
  }, [showToast]);

  // Handle partial speech recognition results
  const handlePartialResult = useCallback((result: { transcript: string; confidence: number; isFinal?: boolean }) => {
    if (!result.isFinal) {
      setState(prev => ({ 
        ...prev, 
        partialTranscript: result.transcript,
        error: null 
      }));
    }
  }, []);

  // Handle final speech recognition results
  const handleSpeechResult = useCallback((result: { transcript: string; confidence: number; isFinal?: boolean }) => {
    const { transcript, confidence } = result;
    
    // Clear partial transcript when we get final result
    setState(prev => ({ ...prev, partialTranscript: '' }));
    
    // Parse intent from transcript
    const intent = parseIntent(transcript, options.steps.length);
    
    if (intent) {
      const confidenceLevel = getConfidenceLevel(intent.confidence);
      const disambiguationPrompt = getDisambiguationPrompt(intent);
      
      setState(prev => ({ 
        ...prev, 
        transcript, 
        error: null, 
        lastIntent: intent,
        confidenceLevel,
        disambiguationPrompt
      }));

      // Check if we should execute immediately or show disambiguation
      if (shouldExecuteIntent(intent)) {
        // Create voice context
        const voiceContext: VoiceContext = {
          steps: options.steps,
          current: options.currentIndex,
          seekTo: options.onSeek,
          speak,
          pause: options.onPause,
          play: options.onPlay,
          setCurrent: options.onStepChange,
          getCurrentTime: options.getCurrentTime || (() => 0),
          mute: options.onMute,
          unmute: options.onUnmute,
        };

        // Handle the intent
        handleIntent(intent, voiceContext);
      } else {
        // Show disambiguation prompt
        if (disambiguationPrompt) {
          speak(disambiguationPrompt);
        }
      }
    } else {
      // No intent recognized
      speak("I didn't understand that. Try saying 'next step' or 'repeat'.");
      setState(prev => ({ 
        ...prev, 
        transcript, 
        error: null, 
        lastIntent: null,
        confidenceLevel: 'low',
        disambiguationPrompt: null
      }));
    }
  }, [options, speak]);

  // Handle speech recognition error
  const handleSpeechError = useCallback((error: { error: string; message: string; raw?: any }) => {
    setState(prev => ({ 
      ...prev, 
      error: error.message, 
      isListening: false,
      lastIntent: null,
      confidenceLevel: 'low',
      disambiguationPrompt: null,
      partialTranscript: ''
    }));
    
    // Show error toast with normalized error codes
    const errorMessage = error.error === 'NO_SPEECH' ? 'No speech detected' :
                        error.error === 'AUDIO_CAPTURE' ? 'Microphone not available' :
                        error.error === 'NOT_ALLOWED' ? 'Microphone permission denied' :
                        error.message;
    
    showToast(`Error: ${errorMessage}`);
  }, [showToast]);

  // Handle speech recognition end
  const handleSpeechEnd = useCallback(() => {
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Start listening
  const startListening = useCallback(async (forceStart = false) => {
    if (!state.isActive && !forceStart) return false;

    // WEB SPEECH path
    if (state.mode === 'webspeech' && speechService.current) {
      const success = await speechService.current.startListening(
        handleSpeechResult,
        handleSpeechError,
        handleSpeechEnd,
        handlePartialResult
      );

      if (success) {
        setState(prev => ({ ...prev, isListening: true, error: null }));
        showToast("Listening...");
      }

      return success;
    }

    // CLOUD STT path (PTT friendly — start now, stop on pointer up)
    if (state.mode === 'cloud' && cloudRecorderRef.current) {
      try {
        await cloudRecorderRef.current.start();
        setState(prev => ({ ...prev, isListening: true, error: null, partialTranscript: '' }));
        showToast("Recording...");
        return true;
      } catch (e: any) {
        handleSpeechError({ error: e?.name || 'AUDIO', message: e?.message || 'Failed to start recording' });
        return false;
      }
    }

    return false;
  }, [state.isActive, state.mode, handleSpeechResult, handleSpeechError, handleSpeechEnd, handlePartialResult, showToast]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (state.mode === 'webspeech' && speechService.current) {
      speechService.current.stopListening();
      setState(prev => ({ ...prev, isListening: false }));
      return;
    }

    // CLOUD: stop and send to server
    if (state.mode === 'cloud' && cloudRecorderRef.current) {
      setState(prev => ({ ...prev, isListening: false }));
      try {
        const { transcript, confidence } = await cloudRecorderRef.current.stopAndTranscribe('/api/stt/google');
        // Reuse your intent pipeline:
        handleSpeechResult({ transcript, confidence, isFinal: true });
      } catch (e: any) {
        handleSpeechError({ error: 'STT_UPLOAD', message: e?.message || 'Transcription failed' });
      }
    }
  }, [state.mode, handleSpeechResult, handleSpeechError]);

  // Step label helper for consistent formatting
  const titleOrSnippet = (s: any) => s?.title || s?.stepText || s?.description || 'Step';

  // Start voice coach
  const startVoiceCoach = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Voice features not supported in this browser' }));
      return false;
    }

    setState(prev => ({ 
      ...prev, 
      isActive: true, 
      error: null,
      lastIntent: null,
      confidenceLevel: 'low',
      disambiguationPrompt: null,
      partialTranscript: ''
    }));
    
    // CRITICAL: Start listening immediately in the same user gesture
    // This ensures mobile browsers allow microphone access
    const listeningStarted = await startListening(true);

    if (listeningStarted) {
      if (state.mode === 'webspeech') {
        speak("Voice coach activated. Say 'next step' to begin.", { resumeSttAfter: true });
      } else {
        speak("Voice coach activated. Press and hold to speak.", { resumeSttAfter: false });
      }
    } else {
      speak("Voice coach activated, but couldn't start microphone. Please check permissions.");
    }
    
    return listeningStarted;
  }, [speak, startListening, state.isSupported, state.mode]);

  // Stop voice coach
  const stopVoiceCoach = useCallback(() => {
    if (state.mode === 'webspeech' && speechService.current) {
      speechService.current.stopListening();
      speechService.current.stopSpeaking();
    }
    setState(prev => ({ 
      ...prev, 
      isActive: false, 
      isListening: false, 
      transcript: '', 
      partialTranscript: '',
      error: null,
      lastIntent: null,
      confidenceLevel: 'low',
      disambiguationPrompt: null,
      isSpeaking: false,
      toast: null
    }));
  }, [state.mode]);

  // Quick actions
  const nextStep = useCallback(() => {
    if (options.currentIndex < options.steps.length - 1) {
      const nextIndex = options.currentIndex + 1;
      options.onStepChange(nextIndex);
      const step = options.steps[nextIndex];
      if (step) {
        options.onSeek(step.start);
        speak(`Step ${nextIndex + 1}. ${titleOrSnippet(step)}`);
      }
    } else {
      speak("You're at the last step.");
    }
  }, [options, speak, titleOrSnippet]);

  const previousStep = useCallback(() => {
    if (options.currentIndex > 0) {
      const prevIndex = options.currentIndex - 1;
      options.onStepChange(prevIndex);
      const step = options.steps[prevIndex];
      if (step) {
        options.onSeek(step.start);
        speak(`Step ${prevIndex + 1}. ${titleOrSnippet(step)}`);
      }
    } else {
      speak("You're at the first step.");
    }
  }, [options, speak, titleOrSnippet]);

  const repeatStep = useCallback(() => {
    const step = options.steps[options.currentIndex];
    if (step) {
      options.onSeek(step.start);
      speak(`Step ${options.currentIndex + 1}. ${titleOrSnippet(step)}`);
    }
  }, [options, speak, titleOrSnippet]);

  const currentStepInfo = useCallback(() => {
    const step = options.steps[options.currentIndex];
    if (step) {
      speak(`You're on step ${options.currentIndex + 1} of ${options.steps.length}. ${titleOrSnippet(step)}`);
    }
  }, [options, speak, titleOrSnippet]);

  // Clear disambiguation prompt
  const clearDisambiguation = useCallback(() => {
    setState(prev => ({ ...prev, disambiguationPrompt: null }));
  }, []);

  // Set language
  const setLanguage = useCallback((lang: string) => {
    if (speechService.current) {
      speechService.current.setLanguage(lang);
    }
  }, []);

  // Get available voices
  const getVoices = useCallback(async () => {
    if (speechService.current) {
      return await speechService.current.getVoices();
    }
    return [];
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    startVoiceCoach,
    stopVoiceCoach,
    startListening,
    stopListening,
    clearDisambiguation,
    setLanguage,
    getVoices,
    
    // Quick actions
    nextStep,
    previousStep,
    repeatStep,
    currentStepInfo,
    
    // Utility
    showToast,
  };
}
