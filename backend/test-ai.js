// Dynamic AI Core Test Script
// Tests AI responses that work with ANY video content

const testAI = async () => {
  console.log('🧪 Testing AI Core with dynamic, content-agnostic questions...\n')
  
  // These questions work with ANY training video
  const universalQuestions = [
    "What is the first step I should take?",
    "Can you explain the overall process?",
    "What should I do next?",
    "Are there any safety considerations?",
    "What's the most important thing to remember?",
    "Can you break this down into simpler steps?",
    "What mistakes should I avoid?",
    "How do I know when I'm doing this correctly?"
  ]
  
  for (const question of universalQuestions) {
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
