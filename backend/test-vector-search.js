// Simple test script for vector search functionality
import { findSimilarQuestions, findSimilarQuestionsScoped } from './dist/services/ai/vectorSearch.js';

async function testVectorSearch() {
  console.log('🧪 Testing vector search functionality...');

  // Test with a dummy embedding (1536 dimensions)
  const testEmbedding = new Array(1536).fill(0.1);

  try {
    console.log('Testing findSimilarQuestions...');
    const results1 = await findSimilarQuestions(testEmbedding, 3);
    console.log('✅ findSimilarQuestions succeeded:', results1.length, 'results');

    console.log('Testing findSimilarQuestionsScoped...');
    const results2 = await findSimilarQuestionsScoped(testEmbedding, ['test-module'], 0.7, 3);
    console.log('✅ findSimilarQuestionsScoped succeeded:', results2.length, 'results');

    console.log('🎉 All vector search tests passed!');
  } catch (error) {
    console.error('❌ Vector search test failed:', error.message);
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testVectorSearch();
}

export { testVectorSearch };
