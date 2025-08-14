import { useEffect, useMemo, useRef, useState } from "react";
import { createSpeechService } from "./factory";

export function useVoiceCoach(ctx: {
  steps: any[];
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  seekTo: (sec: number) => void;
  pause: () => void;
  play: () => void;
}) {
  const svcRef = useRef(createSpeechService());
  const [listening, setListening] = useState(false);
  const [lastText, setLastText] = useState("");

  useEffect(() => {
    const svc = svcRef.current;
    svc.onResult((txt) => {
      setLastText(txt);
      // Simple voice commands for now - can be expanded later
      const lowerText = txt.toLowerCase();
      
      if (lowerText.includes("next") || lowerText.includes("forward")) {
        const nextIndex = Math.min(ctx.currentIndex + 1, ctx.steps.length - 1);
        ctx.setCurrentIndex(nextIndex);
        svc.speak(`Moving to step ${nextIndex + 1}`);
      } else if (lowerText.includes("previous") || lowerText.includes("back")) {
        const prevIndex = Math.max(ctx.currentIndex - 1, 0);
        ctx.setCurrentIndex(prevIndex);
        svc.speak(`Moving to step ${prevIndex + 1}`);
      } else if (lowerText.includes("pause") || lowerText.includes("stop")) {
        ctx.pause();
        svc.speak("Video paused");
      } else if (lowerText.includes("play") || lowerText.includes("start")) {
        ctx.play();
        svc.speak("Video playing");
      } else if (lowerText.includes("read") || lowerText.includes("what")) {
        const currentStep = ctx.steps[ctx.currentIndex];
        if (currentStep) {
          svc.speak(`Step ${ctx.currentIndex + 1}: ${currentStep.description || currentStep.text}`);
        }
      } else {
        svc.speak("Sorry, I didn't understand that command. Try saying 'next', 'previous', 'play', 'pause', or 'read step'");
      }
    });
    
    svc.onError(() => {
      setListening(false);
    });
    
    return () => svc.dispose();
  }, [ctx.currentIndex, ctx.steps, ctx.setCurrentIndex, ctx.seekTo, ctx.pause, ctx.play]);

  const start = async () => {
    if (!svcRef.current.isSttAvailable()) {
      await svcRef.current.speak("Voice input not supported on this device.");
      return;
    }
    await svcRef.current.speak("Listening.");
    await svcRef.current.startListening();
    setListening(true);
  };

  const stop = async () => {
    await svcRef.current.stopListening();
    setListening(false);
  };

  return {
    listening,
    lastText,
    start,
    stop,
    speak: (t: string) => svcRef.current.speak(t),
    ttsAvailable: svcRef.current.isTtsAvailable(),
    sttAvailable: svcRef.current.isSttAvailable()
  };
}
