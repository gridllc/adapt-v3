// App configuration and environment variables
// Centralized config to avoid process.env issues in Vite

export const DEBUG_UI =
  String(import.meta.env.VITE_DEBUG_UI ?? '').toLowerCase() === 'true' ||
  String(import.meta.env.VITE_DEBUG_UI ?? '') === '1';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '';

export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const GOOGLE_CLIENT_ID = import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

// Voice configuration - defaults to Web Speech, Google as optional fallback
export const VOICE_PROVIDER = import.meta.env.VITE_VOICE_PROVIDER ?? 'BROWSER';
export const ENABLE_GOOGLE_VOICE = String(import.meta.env.VITE_ENABLE_GOOGLE_VOICE ?? '').toLowerCase() === 'true';
export const VOICE_FALLBACK_TO_GOOGLE = String(import.meta.env.VITE_VOICE_FALLBACK_TO_GOOGLE ?? '').toLowerCase() === 'true';

// Environment helpers
export const IS_DEV = import.meta.env.DEV;
export const IS_PROD = import.meta.env.PROD;
export const IS_MODE_DEV = import.meta.env.MODE === 'development';
