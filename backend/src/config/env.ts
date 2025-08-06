import { z } from 'zod'

// Environment schema with proper validation
const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('8000'),
  
  // Database (Critical)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // AWS S3 (Critical for file storage)
  AWS_BUCKET_NAME: z.string().min(1, 'AWS_BUCKET_NAME is required'),
  AWS_REGION: z.string().default('us-west-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  
  // QStash (Critical for async processing)
  QSTASH_TOKEN: z.string().min(1, 'QSTASH_TOKEN is required'),
  QSTASH_ENDPOINT: z.string().url().default('https://qstash.upstash.io/v1/publish'),
  QSTASH_WORKER_URL: z.string().url().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  
  // AI Services (At least one required)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  
  // Google Services (Optional)
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),
  
  // Authentication (Critical)
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
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
  
  // In production, fail fast
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 Exiting due to environment validation errors in production')
    process.exit(1)
  } else {
    console.warn('⚠️ Continuing in development mode with invalid environment')
    // Provide fallback env for development
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
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
    } as any
  }
}

// Export validated environment
export { env }

// Helper functions
export const isProduction = () => env?.NODE_ENV === 'production'
export const isDevelopment = () => env?.NODE_ENV === 'development'
export const hasQStash = () => !!env?.QSTASH_TOKEN
export const hasS3 = () => !!(env?.AWS_ACCESS_KEY_ID && env?.AWS_SECRET_ACCESS_KEY && env?.AWS_BUCKET_NAME)
export const hasOpenAI = () => !!env?.OPENAI_API_KEY
export const hasGemini = () => !!env?.GEMINI_API_KEY
export const hasGoogle = () => !!(env?.GOOGLE_CLIENT_EMAIL && env?.GOOGLE_PRIVATE_KEY && env?.GOOGLE_PROJECT_ID)

// Log configuration status (for debugging)
if (env) {
  console.log('🔧 Environment Configuration:')
  console.log(`  📊 Database: ${env.DATABASE_URL ? '✅' : '❌'}`)
  console.log(`  📦 S3: ${hasS3() ? '✅' : '❌'}`)
  console.log(`  ⚡ QStash: ${hasQStash() ? '✅' : '❌'}`)
  console.log(`  🤖 OpenAI: ${hasOpenAI() ? '✅' : '⚠️'}`)
  console.log(`  🔮 Gemini: ${hasGemini() ? '✅' : '⚠️'}`)
  console.log(`  🔒 Clerk: ${env.CLERK_SECRET_KEY ? '✅' : '❌'}`)
  console.log(`  ⚡ QStash: ${env.QSTASH_TOKEN ? '✅' : '❌'}`)
}