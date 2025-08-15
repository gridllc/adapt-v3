import React, { useEffect, useState } from 'react';
import { getSecureContextInfo } from '@/utils/secure-context';

export const SecureContextBanner: React.FC = () => {
  const [secure, setSecure] = useState<boolean>(getSecureContextInfo().isSecure);
  const [perm, setPerm] = useState<'granted'|'denied'|'prompt'|'unknown'>('unknown');
  const [gumErr, setGumErr] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // Permission API not on iOS Safari; guard it.
        // @ts-ignore
        if (navigator.permissions?.query) {
          // @ts-ignore
          const p = await navigator.permissions.query({ name: 'microphone' });
          setPerm(p.state);
          p.onchange = () => setPerm(p.state);
        } else {
          setPerm('unknown');
        }
      } catch { 
        setPerm('unknown'); 
      }
    };

    checkPermissions();
    
    // Check secure context on mount and when location changes
    const checkSecure = () => setSecure(getSecureContextInfo().isSecure);
    checkSecure();
    window.addEventListener('focus', checkSecure);
    
    return () => window.removeEventListener('focus', checkSecure);
  }, []);

  const tryProbe = async () => {
    setGumErr(null);
    setIsTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      console.log('✅ Microphone test successful');
    } catch (e: any) {
      const errorMsg = `${e?.name || 'Error'}: ${e?.message || ''}`;
      setGumErr(errorMsg);
      console.error('❌ Microphone test failed:', errorMsg);
    } finally {
      setIsTesting(false);
    }
  };

  // Don't show banner if everything is working
  if (secure && perm !== 'denied' && !gumErr) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <h4 className="mb-3 font-semibold text-amber-800">🔒 Microphone Access Required</h4>
      
      {!secure && (
        <div className="mb-3">
          <p className="mb-2">
            <strong>Microphone requires HTTPS.</strong> You're on an insecure connection.
          </p>
          <div className="mb-2">
            <button
              onClick={() => {
                const url = `https://${location.host}${location.pathname}${location.search}${location.hash}`;
                location.replace(url);
              }}
              className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 transition-colors"
            >
              🔒 Switch to HTTPS
            </button>
          </div>
          <div className="text-sm text-amber-700">
            <p className="mb-1"><strong>Android Chrome:</strong> Enable "Always use secure connections" in Settings → Privacy & security.</p>
            <p><strong>iOS Safari:</strong> The app will automatically redirect you to HTTPS.</p>
          </div>
        </div>
      )}

      {secure && perm === 'denied' && (
        <div className="mb-3">
          <p className="mb-2">
            <strong>Microphone permission is blocked.</strong>
          </p>
          <div className="text-sm text-amber-700 space-y-2">
            <div>
              <strong>Android Chrome:</strong>
              <ol className="ml-4 mt-1 list-decimal">
                <li>Tap the lock icon 🔒 in the address bar</li>
                <li>Select "Permissions" → "Microphone"</li>
                <li>Choose "Allow"</li>
                <li>Reload the page</li>
              </ol>
            </div>
            <div>
              <strong>iOS Safari:</strong>
              <ol className="ml-4 mt-1 list-decimal">
                <li>Settings → Safari → Camera & Microphone</li>
                <li>Set to "Ask" or "Allow"</li>
                <li>Reload the page and tap "Allow" when prompted</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {secure && gumErr && (
        <div className="mb-3">
          <p className="mb-2">
            <strong>Microphone test failed:</strong> {gumErr}
          </p>
          <div className="text-sm text-amber-700">
            {gumErr.includes('NotAllowedError') && (
              <p>Permission denied. Check site permissions as shown above.</p>
            )}
            {gumErr.includes('NotFoundError') && (
              <p>No microphone found. Check your device has a working microphone.</p>
            )}
            {gumErr.includes('NotReadableError') && (
              <p>Microphone is busy or not accessible. Close other apps using the microphone.</p>
            )}
            {gumErr.includes('NotSupportedError') && (
              <p>Audio format not supported. Try a different browser or device.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button 
          onClick={tryProbe} 
          disabled={isTesting}
          className="rounded border border-amber-400 bg-amber-100 px-4 py-2 text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors"
        >
          {isTesting ? 'Testing...' : '🎤 Test Microphone'}
        </button>
        
        {secure && (
          <button 
            onClick={() => window.location.reload()} 
            className="rounded border border-amber-400 bg-amber-100 px-4 py-2 text-amber-800 hover:bg-amber-200 transition-colors"
          >
            🔄 Reload Page
          </button>
        )}
      </div>
    </div>
  );
};
