import React, { useEffect, useRef, useCallback } from 'react';

interface VoiceCoachOverlayProps {
  isVisible: boolean;
  onStart: () => void;
  onDismiss: () => void;
  dismissOnBackdropClick?: boolean;
}

export const VoiceCoachOverlay: React.FC<VoiceCoachOverlayProps> = ({
  isVisible,
  onStart,
  onDismiss,
  dismissOnBackdropClick = true,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const startBtnRef = useRef<HTMLButtonElement | null>(null);

  // Prevent background scroll when open
  useEffect(() => {
    if (!isVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isVisible]);

  // Focus management + Esc close
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
      if (e.key === 'Tab') {
        // basic focus trap
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    startBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, onDismiss]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dismissOnBackdropClick) return;
      if (e.target === e.currentTarget) onDismiss();
    },
    [dismissOnBackdropClick, onDismiss]
  );

  if (!isVisible) return null;

  const titleId = 'voice-coach-title';
  const descId = 'voice-coach-desc';

  return (
    <div
      className="fixed inset-0 z-[1000] p-4 flex items-center justify-center
                 bg-black/50 md:p-6"
      onMouseDown={handleBackdrop}
      role="presentation"
      style={{
        // Respect iOS safe areas
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-xl
                   outline-none ring-1 ring-black/5
                   transition-all duration-150
                   data-[enter=true]:opacity-100 data-[enter=true]:scale-100
                   opacity-100 scale-100
                   motion-reduce:transition-none"
      >
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl" aria-hidden>🎤</span>
          </div>

          {/* Title */}
          <h3 id={titleId} className="text-xl font-bold text-gray-900 mb-2">
            Start Voice Coach?
          </h3>

          {/* Description */}
          <p id={descId} className="text-gray-600 mb-6">
            Use voice commands to navigate training steps hands‑free.
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              ref={startBtnRef}
              type="button"
              onClick={onStart}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-medium
                         hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
                         transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg" aria-hidden>🎤</span>
              Start Voice Coach
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium
                         hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                         transition-colors"
            >
              Not now
            </button>
          </div>

          {/* Quick tip */}
          <p className="text-xs text-gray-500 mt-4">
            Try: "next step", "repeat", or "go to step 3".
          </p>

          {/* Permission hint (optional, show if you detect NOT_ALLOWED) */}
          {/* <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
            If the microphone is blocked, enable it in your browser's site settings and try again.
          </p> */}
        </div>
      </div>
    </div>
  );
};
