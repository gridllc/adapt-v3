import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useModuleAsk } from "@/hooks/useModuleAsk";

// Types for better TypeScript support
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

// Extend window for speech recognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface VoiceTrainerProps {
  moduleId: string;
  active: boolean;
  stepId?: string;
  onStatusChange?: (status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error') => void;
}

export default function VoiceTrainer({
  moduleId,
  active,
  stepId,
  onStatusChange
}: VoiceTrainerProps) {
  const { ask, isLoading } = useModuleAsk(moduleId);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Update status and notify parent
  const updateStatus = useCallback((newStatus: typeof status) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Check if speech APIs are supported
  useEffect(() => {
    const speechSupported = 'speechSynthesis' in window;
    const recognitionSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    if (!speechSupported || !recognitionSupported) {
      setIsSupported(false);
      setError('Voice features not supported in this browser');
      updateStatus('error');
    }
  }, []);

  // Text-to-speech with queue management
  const speak = useCallback(async (text: string) => {
    if (!text.trim() || !isSupported) return;

    speechQueueRef.current.push(text);

    const processQueue = async () => {
      if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;

      isSpeakingRef.current = true;
      updateStatus('speaking');

      const utterance = new SpeechSynthesisUtterance(speechQueueRef.current.shift()!);

      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        updateStatus('listening');

        // Process next item in queue
        if (speechQueueRef.current.length > 0) {
          setTimeout(processQueue, 100);
        }
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        isSpeakingRef.current = false;
        updateStatus('error');
        setError('Speech synthesis failed');
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Failed to speak:', err);
        isSpeakingRef.current = false;
        updateStatus('error');
      }
    };

    if (!isSpeakingRef.current) {
      await processQueue();
    }
  }, [isSupported, updateStatus]);

  // Send question to AI
  const sendToAI = useCallback(async (question: string) => {
    if (!question.trim()) return;

    updateStatus('processing');
    setInterimText('');

    try {
      const response = await ask(question.trim(), { stepId });
      const answer = response?.answer || response?.text || 'I apologize, but I couldn\'t process your question right now.';

      await speak(answer);
    } catch (err) {
      console.error('AI query failed:', err);
      await speak('Sorry, I encountered an error while processing your question. Please try again.');
      updateStatus('listening');
    }
  }, [ask, stepId, speak, updateStatus]);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      updateStatus('listening');
      setError('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInterimText(interimTranscript);

      if (finalTranscript) {
        sendToAI(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      let errorMessage = '';

      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please speak clearly.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone detected. Please check your microphone.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      setError(errorMessage);
      updateStatus('error');
    };

    recognition.onend = () => {
      if (status === 'listening') {
        // Auto-restart if we're supposed to be listening
        setTimeout(() => {
          if (active && recognitionRef.current) {
            try {
              recognition.start();
            } catch (err) {
              console.error('Failed to restart speech recognition:', err);
            }
          }
        }, 100);
      }
    };

    return recognition;
  }, [isSupported, active, sendToAI, updateStatus, status]);

  // Main effect for starting/stopping voice training
  useEffect(() => {
    if (!isSupported) return;

    if (active) {
      // Stop any existing speech
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      speechQueueRef.current = [];

      // Start speech recognition
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
          speak('Voice training started. I\'m listening for your questions.');
        } catch (err) {
          console.error('Failed to start speech recognition:', err);
          setError('Failed to start voice recognition. Please try again.');
          updateStatus('error');
        }
      }
    } else {
      // Stop everything
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      speechQueueRef.current = [];

      updateStatus('idle');
      setInterimText('');
      setError('');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, [active, isSupported, initSpeechRecognition, speak, updateStatus]);

  // Don't render if not supported
  if (!isSupported) {
    return (
      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-yellow-800">
          <span>🎤</span>
          <span>Voice features not supported in this browser</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <div className={`h-2 w-2 rounded-full transition-colors ${
            status === 'listening' ? 'bg-green-500 animate-pulse' :
            status === 'speaking' ? 'bg-blue-500 animate-pulse' :
            status === 'processing' ? 'bg-yellow-500 animate-pulse' :
            status === 'error' ? 'bg-red-500' :
            'bg-gray-300'
          }`} />
          <span className={`${
            status === 'listening' ? 'text-green-700' :
            status === 'speaking' ? 'text-blue-700' :
            status === 'processing' ? 'text-yellow-700' :
            status === 'error' ? 'text-red-700' :
            'text-gray-500'
          }`}>
            {status === 'listening' ? '🎤 Listening...' :
             status === 'speaking' ? '🔊 Speaking...' :
             status === 'processing' ? '🤔 Thinking...' :
             status === 'error' ? '❌ Error' :
             'Idle'}
          </span>
        </div>

        {active && (
          <button
            onClick={() => {
              if (recognitionRef.current) {
                recognitionRef.current.stop();
              }
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border"
          >
            Stop Listening
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Interim text */}
      {interimText && status === 'listening' && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
          <div className="text-sm text-blue-700 italic">
            "{interimText}"
          </div>
        </div>
      )}

      {/* Privacy notice */}
      {active && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
          🔒 Your voice is processed locally and only your questions are sent to the AI for responses.
        </div>
      )}
    </div>
  );
}
