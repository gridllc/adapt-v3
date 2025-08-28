import React, { useState, useEffect, useRef } from 'react';
import { useModuleAsk } from '@/hooks/useModuleAsk';

interface VoiceTrainerProps {
  moduleId: string;
  onQuestionAsked?: (question: string) => void;
  autoStart?: boolean; // Auto-start voice recognition when true
}

export default function VoiceTrainer({ moduleId, onQuestionAsked, autoStart = false }: VoiceTrainerProps) {
  const { ask } = useModuleAsk();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Voice recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening continuously
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onresult = (event: any) => {
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

      setTranscript(interimTranscript);

      if (finalTranscript) {
        handleVoiceCommand(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      setError(`Voice error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTranscript('');

      // Auto-restart if we're supposed to be listening (for continuous mode)
      if (autoStart) {
        setTimeout(() => {
          if (recognitionRef.current && !isListening) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.warn('Failed to auto-restart voice recognition:', err);
            }
          }
        }, 1000); // Wait 1 second before restarting
      }
    };

    recognitionRef.current = recognition;
  }, []);

  // Auto-start voice recognition when autoStart becomes true
  useEffect(() => {
    if (autoStart && isSupported && recognitionRef.current) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        if (!isListening) {
          try {
            recognitionRef.current.start();
          } catch (err) {
            console.warn('Auto-start voice recognition failed:', err);
          }
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoStart, isSupported]); // Removed isListening to prevent conflicts

  const handleVoiceCommand = async (command: string) => {
    if (!command.trim()) return;

    try {
      // Process the voice command through the AI assistant
      await ask(moduleId, command.trim());
      onQuestionAsked?.(command.trim());

      // Show success feedback
      setError('');
    } catch (err) {
      console.error('Voice command failed:', err);
      setError('Failed to process voice command');
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        setError('Failed to start voice recognition');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  if (!isSupported) {
    return (
      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
        🎤 Voice features not supported in this browser
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-purple-500 hover:bg-purple-600 text-white'
          }`}
          disabled={!isSupported}
        >
          {isListening ? '🔴 Stop Listening' : autoStart ? '🎤 Auto-Listening' : '🎤 Start Voice'}
        </button>

        <span className={`text-sm ${isListening ? 'text-green-600' : 'text-gray-500'}`}>
          {isListening ? 'Listening...' : autoStart ? 'Voice assistant active' : 'Voice assistant ready'}
        </span>
        {autoStart && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
            Auto-started
          </span>
        )}
      </div>

      {transcript && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 italic">
          "{transcript}"
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        🎤 Voice commands are automatically sent to AI. Try saying: "What's the second step?", "Next step", "How many steps?", or "Read the current step"
      </div>
    </div>
  );
}
