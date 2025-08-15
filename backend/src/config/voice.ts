// Voice configuration for backend
// Centralized voice settings with proper guards for Google services

export const VOICE_CONFIG = {
  // Enable/disable voice features
  ENABLE_SERVER_VOICE: (process.env.ENABLE_SERVER_VOICE || 'false').toLowerCase() === 'true',
  
  // Voice provider selection
  PROVIDER: (process.env.VOICE_PROVIDER || 'BROWSER').toUpperCase(), // BROWSER | GOOGLE
  
  // Google Cloud STT specific settings
  ENABLE_GOOGLE_STT: (process.env.ENABLE_GOOGLE_STT || 'false').toLowerCase() === 'true',
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  
  // Voice settings
  DEFAULT_LANG: process.env.VOICE_LANG || 'en-US',
  DEFAULT_VOICE: process.env.VOICE_VOICE_NAME || 'en-US-Neutral',
  
  // Fallback behavior
  FALLBACK_TO_BROWSER: true, // Always fallback to browser Web Speech API
};

// Helper functions
export const isGoogleVoiceEnabled = () => {
  return VOICE_CONFIG.ENABLE_SERVER_VOICE && 
         VOICE_CONFIG.PROVIDER === 'GOOGLE' && 
         VOICE_CONFIG.ENABLE_GOOGLE_STT &&
         !!VOICE_CONFIG.GOOGLE_PROJECT_ID &&
         !!VOICE_CONFIG.GOOGLE_APPLICATION_CREDENTIALS;
};

export const isBrowserVoiceEnabled = () => {
  return VOICE_CONFIG.ENABLE_SERVER_VOICE && 
         VOICE_CONFIG.PROVIDER === 'BROWSER';
};

export const getVoiceStatus = () => {
  return {
    serverVoiceEnabled: VOICE_CONFIG.ENABLE_SERVER_VOICE,
    provider: VOICE_CONFIG.PROVIDER,
    googleEnabled: isGoogleVoiceEnabled(),
    browserEnabled: isBrowserVoiceEnabled(),
    fallback: 'Browser Web Speech API',
    note: isGoogleVoiceEnabled() 
      ? 'Google Voice enabled with valid credentials'
      : 'Using Browser Web Speech API (Google Voice disabled or not configured)'
  };
};
