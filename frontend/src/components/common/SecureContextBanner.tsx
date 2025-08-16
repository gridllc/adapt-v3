export default function SecureContextBanner() {
  const secure = typeof window !== "undefined" && (window.isSecureContext || location.host.includes("localhost"));
  if (secure) return null;
  // Only show if actually insecure
  return (
    <div className="fixed bottom-2 left-2 z-50 rounded-md bg-amber-100 text-amber-900 px-3 py-2 text-sm shadow">
      Microphone needs HTTPS. Open this site over https:// or localhost.
    </div>
  );
}
