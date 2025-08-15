// secure-context.ts
export function ensureHttps() {
  if (location.protocol === 'http:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1') {
    const url = `https://${location.host}${location.pathname}${location.search}${location.hash}`;
    location.replace(url); // no back button to http
  }
}

export function isSecure(): boolean {
  return window.isSecureContext;
}

export function getSecureContextInfo() {
  return {
    isSecure: window.isSecureContext,
    protocol: location.protocol,
    hostname: location.hostname,
    isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    needsHttps: location.protocol === 'http:' && !(location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  };
}
