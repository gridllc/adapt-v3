#!/usr/bin/env node

// Test script to verify environment configuration
console.log('🔧 Testing Environment Configuration...\n')

// Test Gemini configuration
const ENABLE_GEMINI = (process.env.ENABLE_GEMINI || '').toLowerCase() === 'true'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const USE_GEMINI = ENABLE_GEMINI && !!(GEMINI_API_KEY && GEMINI_API_KEY.trim())

console.log('Gemini Configuration:')
console.log(`  ENABLE_GEMINI: ${process.env.ENABLE_GEMINI || 'undefined'} -> ${ENABLE_GEMINI}`)
console.log(`  GEMINI_API_KEY: ${GEMINI_API_KEY ? 'SET' : 'NOT SET'}`)
console.log(`  USE_GEMINI: ${USE_GEMINI}`)
console.log('')

// Test OpenAI configuration
const OPENAI_MODEL_STEPS = process.env.OPENAI_MODEL_STEPS || 'gpt-4o-mini'
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2)
const AI_MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 800)

console.log('OpenAI Configuration:')
console.log(`  OPENAI_MODEL_STEPS: ${OPENAI_MODEL_STEPS}`)
console.log(`  AI_TEMPERATURE: ${AI_TEMPERATURE}`)
console.log(`  AI_MAX_OUTPUT_TOKENS: ${AI_MAX_OUTPUT_TOKENS}`)
console.log('')

// Test QStash configuration
const QSTASH_ENABLED = (process.env.QSTASH_ENABLED || '').toLowerCase() === 'true'
const QSTASH_TOKEN = process.env.QSTASH_TOKEN

console.log('QStash Configuration:')
console.log(`  QSTASH_ENABLED: ${process.env.QSTASH_ENABLED || 'undefined'} -> ${QSTASH_ENABLED}`)
console.log(`  QSTASH_TOKEN: ${QSTASH_TOKEN ? 'SET' : 'NOT SET'}`)
console.log('')

// Test transcript configuration
const MAX_TRANSCRIPT_CHARS = Number(process.env.MAX_TRANSCRIPT_CHARS ?? 10000)

console.log('Transcript Configuration:')
console.log(`  MAX_TRANSCRIPT_CHARS: ${MAX_TRANSCRIPT_CHARS}`)
console.log('')

// Summary
console.log('📊 Summary:')
console.log(`  Gemini will be used: ${USE_GEMINI ? 'YES' : 'NO'}`)
console.log(`  OpenAI model: ${OPENAI_MODEL_STEPS}`)
console.log(`  QStash enabled: ${QSTASH_ENABLED}`)
console.log(`  Transcript cap: ${MAX_TRANSCRIPT_CHARS} characters`)

if (!USE_GEMINI) {
  console.log('\n✅ Gemini is properly disabled - cost optimization active!')
} else {
  console.log('\n⚠️ Gemini is enabled - ensure this is intentional')
}
