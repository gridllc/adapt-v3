// Quick AI Core Test Script
// Test the contextual AI responses with existing training content

const testAI = async () => {
  console.log('🧪 Testing AI Core with your existing training content...\n')
  
  const testQuestions = [
    "How do I enter the house safely?",
    "What should I do when getting the remote?",
    "I'm at the lights step, what's next?",
    "Can you explain the overall process?",
    "What are the key safety considerations?"
  ]
  
  for (const question of testQuestions) {
    console.log(`🤖 Question: "${question}"`)
    
    try {
      const response = await fetch('http://localhost:8000/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: 'test-module', // We'll use a real module ID
          question: question
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log(`✅ Answer: ${result.answer.substring(0, 100)}...`)
      } else {
        console.log(`❌ Error: ${response.status} - ${response.statusText}`)
      }
    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`)
    }
    
    console.log('---')
  }
}

// Run the test
testAI().catch(console.error)
