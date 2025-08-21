#!/usr/bin/env node

/**
 * Test script to verify webhook signature verification
 * Run with: node test-webhook-signature.js
 */

import crypto from 'crypto'

// Test the signature verification logic
function testWebhookSignature() {
  console.log('🧪 Testing webhook signature verification...')
  
  // Simulate AssemblyAI webhook secret
  const secret = 'test-secret-123'
  
  // Simulate webhook payload
  const payload = JSON.stringify({
    status: 'completed',
    id: 'test-transcript-123',
    text: 'This is a test transcript for testing purposes.'
  })
  
  // Create HMAC signature (base64 encoding)
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('base64')
  
  console.log('📝 Test payload:', payload)
  console.log('🔐 Expected HMAC (base64):', expectedHmac)
  console.log('🔐 Expected length:', expectedHmac.length)
  
  // Test signature verification
  const receivedSig = expectedHmac // Perfect match
  const wrongSig = 'wrong-signature-123'
  
  console.log('\n✅ Testing correct signature:')
  const correctMatch = crypto.timingSafeEqual(
    Buffer.from(expectedHmac), 
    Buffer.from(receivedSig)
  )
  console.log('Correct signature match:', correctMatch)
  
  console.log('\n❌ Testing wrong signature:')
  try {
    const wrongMatch = crypto.timingSafeEqual(
      Buffer.from(expectedHmac), 
      Buffer.from(wrongSig)
    )
    console.log('Wrong signature match:', wrongMatch)
  } catch (err) {
    console.log('Expected error for wrong signature:', err.message)
  }
  
  console.log('\n🔒 Testing safe comparison function:')
  function safeTimingEqual(a, b) {
    if (a.length !== b.length) {
      console.log(`⚠️ Length mismatch: expected ${a.length}, got ${b.length}`)
      return false
    }
    try {
      return crypto.timingSafeEqual(a, b)
    } catch (err) {
      console.log('⚠️ Timing-safe comparison failed:', err.message)
      return false
    }
  }
  
  const safeCorrect = safeTimingEqual(Buffer.from(expectedHmac), Buffer.from(receivedSig))
  const safeWrong = safeTimingEqual(Buffer.from(expectedHmac), Buffer.from(wrongSig))
  
  console.log('Safe correct signature:', safeCorrect)
  console.log('Safe wrong signature:', safeWrong)
  
  console.log('\n🏁 Test completed successfully!')
}

// Run the test
testWebhookSignature()
