/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_API_URL: string
  readonly VITE_FORCE_PRODUCTION_API: string
  readonly DEV: boolean
  readonly MODE: string
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}