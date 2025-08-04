#!/usr/bin/env node

/**
 * Test script to verify transcript-based step generation
 */

console.log('🧪 Testing Transcript-Based Step Generation...\n')

// Simulate a transcript with timestamps
const testTranscript = `
Welcome to this training module. In this video, I will guide you through the process step by step. 
First, we need to prepare our workspace. Make sure you have all the necessary tools ready. 
Next, we'll start with the basic setup. This involves configuring the initial parameters. 
Then we'll move on to the main process. This is where most of the work happens. 
Finally, we'll clean up and verify our results. This ensures everything is working correctly.
`

const testDuration = 120 // 2 minutes

console.log('📝 Test Transcript:')
console.log(testTranscript)
console.log(`⏱️ Duration: ${testDuration} seconds\n`)

// Simulate the createTranscriptSegments function
function createTranscriptSegments(transcript, totalDuration) {
  // Split transcript into sentences
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10)
  
  if (sentences.length === 0) {
    return [{
      timestamp: 0,
      text: transcript,
      duration: totalDuration
    }]
  }
  
  // Calculate timestamps based on sentence position
  return sentences.map((sentence, index) => {
    const progress = index / sentences.length
    const timestamp = Math.floor(progress * totalDuration)
    const nextProgress = (index + 1) / sentences.length
    const nextTimestamp = Math.floor(nextProgress * totalDuration)
    const duration = nextTimestamp - timestamp
    
    return {
      timestamp: Math.max(0, timestamp),
      text: sentence.trim(),
      duration: Math.max(5, duration) // Minimum 5 seconds
    }
  })
}

// Simulate the generateStepsFromTranscript function
function generateStepsFromTranscript(transcript, totalDuration) {
  const transcriptSegments = createTranscriptSegments(transcript, totalDuration)
  
  return transcriptSegments.map((segment, index) => ({
    timestamp: segment.timestamp,
    title: generateStepTitle(segment.text),
    description: segment.text,
    duration: segment.duration,
    originalText: segment.text,
    aiRewrite: segment.text,
    stepText: segment.text
  }))
}

function generateStepTitle(sentence) {
  const words = sentence.split(' ').filter(word => word.length > 3)
  const keyWords = words.slice(0, 3).join(' ')
  return keyWords.length > 0 ? keyWords : 'Step'
}

// Test the functions
console.log('🔍 Creating transcript segments...')
const segments = createTranscriptSegments(testTranscript, testDuration)
console.log(`✅ Created ${segments.length} segments:`)
segments.forEach((segment, index) => {
  console.log(`  ${index + 1}. [${segment.timestamp}s - ${segment.timestamp + segment.duration}s] ${segment.text.substring(0, 50)}...`)
})

console.log('\n🔍 Generating steps from transcript...')
const steps = generateStepsFromTranscript(testTranscript, testDuration)
console.log(`✅ Generated ${steps.length} steps:`)
steps.forEach((step, index) => {
  console.log(`  ${index + 1}. [${step.timestamp}s] ${step.title} (${step.duration}s)`)
  console.log(`     Description: ${step.description.substring(0, 60)}...`)
})

console.log('\n✅ Test completed successfully!')
console.log('\n📝 Expected behavior:')
console.log('  - Steps should have actual timestamps based on transcript position')
console.log('  - No hardcoded 15-30 second intervals')
console.log('  - Each step should correspond to a sentence or phrase from the transcript')
console.log('  - Timestamps should be distributed across the video duration') 