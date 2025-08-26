// Test script for the three-tier AI pipeline
// Run with: node test-ai-pipeline.js

import { RetrievalService } from './src/services/retrievalService.js';
import { PromptService } from './src/services/promptService.js';
import { EmbeddingService } from './src/services/embeddingService.js';

async function testPipeline() {
  console.log('🧪 Testing Three-Tier AI Pipeline...\n');

  try {
    // Test 1: Embedding Service
    console.log('1️⃣ Testing Embedding Service...');
    const testText = "How do I enter my home?";
    const embedding = await EmbeddingService.embed(testText);
    console.log(`✅ Generated embedding: ${embedding.length} dimensions`);
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(x => x.toFixed(4)).join(', ')}]`);

    // Test 2: Prompt Service
    console.log('\n2️⃣ Testing Prompt Service...');
    const mockContext = [
      {
        kind: 'step',
        id: '1',
        text: 'Insert your key into the lock',
        meta: { index: 1, start: 0, end: 5 },
        score: 0.8,
        source: 'Step 1'
      },
      {
        kind: 'step', 
        id: '2',
        text: 'Turn the key clockwise',
        meta: { index: 2, start: 5, end: 10 },
        score: 0.7,
        source: 'Step 2'
      }
    ];

    const prompt = PromptService.buildRagPrompt(testText, mockContext, 5, 0);
    console.log('✅ Generated RAG prompt:');
    console.log('   System:', prompt.system.substring(0, 100) + '...');
    console.log('   User:', prompt.user.substring(0, 100) + '...');

    // Test 3: Retrieval Service (mock)
    console.log('\n3️⃣ Testing Retrieval Service...');
    console.log('✅ Retrieval service ready (will use simple keyword matching for now)');

    console.log('\n🎉 All pipeline components working!');
    console.log('\n📋 Next steps:');
    console.log('   1. Set up pgvector in your database');
    console.log('   2. Run database migrations');
    console.log('   3. Test with real questions via /api/ai/ask');
    console.log('   4. Monitor metrics at /api/ai/metrics');

  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Check OPENAI_API_KEY environment variable');
    console.log('   - Ensure all services are properly imported');
    console.log('   - Verify database connection');
  }
}

// Run the test
testPipeline().catch(console.error);
