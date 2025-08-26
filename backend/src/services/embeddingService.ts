import OpenAI from 'openai';

// Initialize OpenAI client for embeddings
let openai: OpenAI | undefined;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI initialized for embeddings');
  }
} catch (error) {
  console.error(`❌ Failed to initialize OpenAI for embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

export class EmbeddingService {
  
  /**
   * Generate embedding for text using OpenAI
   */
  static async embed(text: string): Promise<number[]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  static async embedBatch(texts: string[]): Promise<number[][]> {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        dimensions: 1536,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('❌ Batch embedding generation failed:', error);
      throw new Error('Failed to generate batch embeddings');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  /**
   * Calculate similarity score (0-1, higher is better)
   */
  static similarityScore(a: number[], b: number[]): number {
    const cosine = this.cosineSimilarity(a, b);
    // Convert from [-1, 1] to [0, 1] range
    return (cosine + 1) / 2;
  }
}
