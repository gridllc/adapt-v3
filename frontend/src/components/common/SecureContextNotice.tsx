import React from "react";

interface Props {
  className?: string;
}

/** Shows only when the page isn’t secure (no HTTPS) so mic/features won’t work. */
export default function SecureContextNotice({ className = "" }: Props) {
  const isSecure = typeof window !== "undefined" && window.isSecureContext;
  if (isSecure) return null;

  const isLocalhost =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname);

  return (
    <div className={`rounded-md border border-yellow-200 bg-yellow-50 p-3 ${className}`}>
      <p className="text-sm text-yellow-800">
        You’re on an insecure page ({window.location.protocol}). Microphone and some APIs require HTTPS.
        {isLocalhost ? " On localhost this is expected; use https://localhost if available." : " Please use the HTTPS version of this site."}
      </p>
    </div>
  );
}
