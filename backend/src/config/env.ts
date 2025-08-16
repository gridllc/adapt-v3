import { z } from 'zod'

// Environment schema with proper validation
const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
    .default(8000),
  API_BASE_URL: z.string().url().optional(),
  
  // Database (Critical)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // AWS S3 (Critical for file storage)
  AWS_BUCKET_NAME: z.string().min(1, 'AWS_BUCKET_NAME is required'),
  AWS_REGION: z.string().default('us-west-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  
  // QStash (Critical for async processing)
  QSTASH_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_ENDPOINT: z.string().url().default('https://qstash.upstash.io/v1/publish'),
  QSTASH_WORKER_URL: z.string().url().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  
  // AI Services (At least one required)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_STEPS: z.string().default('gpt-4o-mini'),
  AI_TEMPERATURE: z.string().transform((val) => Number(val)).default('0.2'),
  AI_MAX_OUTPUT_TOKENS: z.string().transform((val) => Number(val)).default('800'),
  ENABLE_GEMINI: z.string().transform((val) => val === 'true').default('false'),
  GEMINI_API_KEY: z.string().optional(),
  MAX_TRANSCRIPT_CHARS: z.string().transform((val) => Number(val)).default('10000'),
  
  // Google Services (Optional)
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),
  
  // Authentication (Critical)
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Security & Access Control
  ALLOWED_EMAILS: z.string().optional(), // Comma-separated list for friends & family beta
  MAX_UPLOADS_PER_USER: z
    .union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
    .default(5), // Default to 5 uploads per user during beta
  
  // Upload Configuration
  MAX_FILE_SIZE: z
    .union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
    .default(209715200), // 200MB in bytes
  ALLOWED_VIDEO_TYPES: z.string().default('video/mp4,video/mov,video/webm,video/avi,video/wmv,video/flv'),
  UPLOAD_TIMEOUT: z
    .union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
    .default(300000), // 5 minutes in ms
  ENABLE_FILE_COMPRESSION: z.string().transform((val) => val === 'true').default('true'),
  
  // Optional
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
})

// Parse and validate environment
let env: z.infer<typeof envSchema> | undefined

try {
  env = envSchema.parse(process.env)
  
  // Additional validation: At least one AI service required
  if (!env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
    throw new Error('At least one AI service (OPENAI_API_KEY or GEMINI_API_KEY) is required')
  }
  
  // Additional validation: Gemini requires explicit enablement
  if (env.ENABLE_GEMINI && !env.GEMINI_API_KEY) {
    throw new Error('ENABLE_GEMINI=true requires GEMINI_API_KEY to be set')
  }
  
  console.log('✅ Environment validation passed')
  
} catch (error) {
  console.error('❌ Environment validation failed:')
  
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`)
    })
  } else {
    console.error(`  - ${error}`)
  }
  
  // Check for critical environment variables that should always fail
  const criticalVars = ['DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME', 'QSTASH_TOKEN', 'CLERK_SECRET_KEY']
  const missingCritical = criticalVars.filter(key => !process.env[key])
  
  if (missingCritical.length > 0) {
    console.error(`❌ Missing critical environment variables: ${missingCritical.join(', ')}`)
    console.error('🚨 Exiting due to missing critical environment variables')
    process.exit(1)
  }
  
  // Only allow fallback for non-critical variables in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Continuing in development mode with some missing optional variables')
    // Provide minimal fallback env for development
    env = {
      NODE_ENV: 'development',
      PORT: 8000,
      DATABASE_URL: process.env.DATABASE_URL || '',
      AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME || '',
      AWS_REGION: process.env.AWS_REGION || 'us-west-1',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
      QSTASH_TOKEN: process.env.QSTASH_TOKEN || '',
      QSTASH_ENDPOINT: process.env.QSTASH_ENDPOINT || 'https://qstash.upstash.io/v1/publish',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
      MAX_FILE_SIZE: 104857600,
      ALLOWED_VIDEO_TYPES: 'video/mp4,video/mov,video/webm,video/avi,video/wmv,video/flv',
      UPLOAD_TIMEOUT: 300000,
      ENABLE_FILE_COMPRESSION: 'true'
    } as any
  } else {
    console.error('🚨 Exiting due to environment validation errors in production')
    process.exit(1)
  }
}

// Export validated environment
const config = env as z.infer<typeof envSchema>

export default config
export { config as env }

// Helper functions
export const isProduction = () => config?.NODE_ENV === 'production'
export const isDevelopment = () => config?.NODE_ENV === 'development'
export const hasQStash = () => !!config?.QSTASH_TOKEN
export const hasS3 = () => !!(config?.AWS_ACCESS_KEY_ID && config?.AWS_SECRET_ACCESS_KEY && config?.AWS_BUCKET_NAME)
export const hasOpenAI = () => !!config?.OPENAI_API_KEY
export const hasGemini = () => config?.ENABLE_GEMINI && !!config?.GEMINI_API_KEY
export const hasGoogle = () => !!(config?.GOOGLE_CLIENT_EMAIL && config?.GOOGLE_PRIVATE_KEY && config?.GOOGLE_PROJECT_ID)
export const isQStashEnabled = () => config?.QSTASH_ENABLED === true

// Upload configuration helpers
export const getUploadConfig = () => ({
  maxFileSize: config?.MAX_FILE_SIZE || 209715200, // 200MB default
  allowedVideoTypes: config?.ALLOWED_VIDEO_TYPES?.split(',').map(t => t.trim()) || ['video/mp4', 'video/mov', 'video/webm'],
  uploadTimeout: config?.UPLOAD_TIMEOUT || 300000, // 5 minutes default
  enableCompression: config?.ENABLE_FILE_COMPRESSION !== false
})

export const getMaxFileSize = () => config?.MAX_FILE_SIZE || 209715200
export const getAllowedVideoTypes = () => config?.ALLOWED_VIDEO_TYPES?.split(',').map(t => t.trim()) || ['video/mp4', 'video/mov', 'video/webm']
export const getUploadTimeout = () => config?.UPLOAD_TIMEOUT || 300000
export const isCompressionEnabled = () => config?.ENABLE_FILE_COMPRESSION !== false
export const getApiBaseUrl = () => config?.API_BASE_URL || 'http://localhost:8000'

export const getAllowedEmails = (): string[] => {
  return config?.ALLOWED_EMAILS
    ? config.ALLOWED_EMAILS.split(',').map(email => email.trim().toLowerCase())
    : []
}

export const getMaxUploadsPerUser = (): number => {
  return config?.MAX_UPLOADS_PER_USER || 5
}

// Log configuration status (for debugging)
if (config) {
  console.log('🔧 Environment Configuration:')
  console.log(`  📊 Database: ${config.DATABASE_URL ? '✅' : '❌'}`)
  console.log(`  📦 S3: ${hasS3() ? '✅' : '❌'}`)
  console.log(`  ⚡ QStash: ${isQStashEnabled() ? '✅' : '❌'}`)
  console.log(`  🤖 OpenAI: ${hasOpenAI() ? '✅' : '⚠️'}`)
  console.log(`  🔮 Gemini: ${hasGemini() ? '✅' : '⚠️'}`)
  console.log(`  🔒 Clerk: ${config.CLERK_SECRET_KEY ? '✅' : '❌'}`)
}
