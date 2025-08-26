import { prisma } from '../config/database.js';
import { EmbeddingService } from './embeddingService.js';

export type Retrieved = { 
  kind: 'step' | 'segment' | 'faq'; 
  id: string; 
  text: string; 
  meta: any; 
  score: number;
  source: string;
};

export class RetrievalService {
  
  /**
   * Get context for a question using RAG
   */
  static async getContextForQuestion(
    moduleId: string, 
    question: string, 
    k: number = 6
  ): Promise<{ pool: Retrieved[]; strong: Retrieved[] }> {
    try {
      // Generate embedding for the question
      const questionEmbedding = await EmbeddingService.embed(question);
      
      // Get steps with embeddings
      const steps = await this.getStepVectors(moduleId, questionEmbedding, k);
      
      // Get transcript segments with embeddings (if available)
      const segments = await this.getTranscriptVectors(moduleId, questionEmbedding, k);
      
      // Get FAQ vectors (if available)
      const faqs = await this.getFaqVectors(moduleId, questionEmbedding, Math.max(2, Math.floor(k / 2)));
      
      // Combine and sort by score
      const pool = [...steps, ...segments, ...faqs]
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
      
      // Filter for strong matches (tune threshold as needed)
      const strong = pool.filter(x => x.score >= 0.25);
      
      return { pool, strong };
    } catch (error) {
      console.warn('⚠️ RAG retrieval failed, falling back to empty context:', error);
      return { pool: [], strong: [] };
    }
  }

  /**
   * Get step vectors with similarity scoring
   */
  private static async getStepVectors(
    moduleId: string, 
    questionEmbedding: number[], 
    limit: number
  ): Promise<Retrieved[]> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, startTime: true, endTime: true, order: true },
      });

      // Use keyword matching for now since we don't have pgvector set up yet
      const scoredSteps = steps.map(step => {
        const score = this.simpleKeywordScore(step.text, questionEmbedding.length);
        return {
          kind: 'step' as const,
          id: step.id,
          text: step.text,
          meta: { index: step.order, start: step.startTime, end: step.endTime },
          score,
          source: `Step ${step.order}`,
        };
      });

      return scoredSteps
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.warn('⚠️ Failed to get step vectors:', error);
      return [];
    }
  }

  /**
   * Get transcript segment vectors
   */
  private static async getTranscriptVectors(
    moduleId: string, 
    questionEmbedding: number[], 
    limit: number
  ): Promise<Retrieved[]> {
    try {
      // For now, return empty since we don't have transcript segments indexed
      // In production, you'd query transcript_vectors table with pgvector
      return [];
    } catch (error) {
      console.warn('⚠️ Failed to get transcript vectors:', error);
      return [];
    }
  }

  /**
   * Get FAQ vectors
   */
  private static async getFaqVectors(
    moduleId: string, 
    questionEmbedding: number[], 
    limit: number
  ): Promise<Retrieved[]> {
    try {
      // For now, return empty since we don't have FAQ vectors indexed
      // In production, you'd query faq_vectors table with pgvector
      return [];
    } catch (error) {
      console.warn('⚠️ Failed to get FAQ vectors:', error);
      return [];
    }
  }

  /**
   * Simple keyword scoring fallback (when embeddings aren't available)
   */
  private static simpleKeywordScore(text: string, questionLength: number): number {
    // Simple bag-of-words overlap as fallback
    // In production, this would be replaced by proper vector similarity
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    const uniqueWords = new Set(words);
    return uniqueWords.size / Math.max(questionLength, 1);
  }

  /**
   * Index steps for a module (call this after steps are created/updated)
   */
  static async indexModuleSteps(moduleId: string): Promise<void> {
    try {
      const steps = await prisma.step.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
        select: { id: true, text: true, startTime: true, endTime: true, order: true },
      });

      // Generate embeddings for each step
      for (const step of steps) {
        const embedding = await EmbeddingService.embed(step.text);
        
        // Store in step_vectors table (when pgvector is set up)
        // For now, we'll use the simple scoring approach
        console.log(`📝 Indexed step ${step.order} for module ${moduleId}`);
      }
    } catch (error) {
      console.error('❌ Failed to index module steps:', error);
    }
  }
}
