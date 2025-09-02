import { prisma } from '../../config/database.js';

export async function findSimilarQuestions(embedding: number[], topN = 5) {
  // Check if vector data exists before querying
  const result = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    'SELECT EXISTS (SELECT 1 FROM "question_vectors" LIMIT 1) AS exists'
  );
  const exists = result[0]?.exists || false;

  if (!exists) {
    console.log('⚠️ No vector data found, skipping KNN search');
    return [];
  }

  // For now, return empty array since we can't do vector operations without pgvector
  console.log('⚠️ Vector search disabled - pgvector extension not available');
  return [];
}

export async function findSimilarQuestionsScoped(
  embedding: number[],
  moduleIds: string[],
  threshold: number = 0.8,
  topN = 5
) {
  // Check if vector data exists before querying
  const result = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    'SELECT EXISTS (SELECT 1 FROM "question_vectors" LIMIT 1) AS exists'
  );
  const exists = result[0]?.exists || false;

  if (!exists) {
    console.log('⚠️ No vector data found, skipping scoped KNN search');
    return [];
  }

  // For now, return empty array since we can't do vector operations without pgvector
  console.log('⚠️ Vector search disabled - pgvector extension not available');
  return [];
}

export async function findSimilarQuestionsGlobal(
  embedding: number[],
  topN = 5
) {
  // Check if vector data exists before querying
  const result = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    'SELECT EXISTS (SELECT 1 FROM "question_vectors" LIMIT 1) AS exists'
  );
  const exists = result[0]?.exists || false;

  if (!exists) {
    console.log('⚠️ No vector data found, skipping global KNN search');
    return [];
  }

  // For now, return empty array since we can't do vector operations without pgvector
  console.log('⚠️ Vector search disabled - pgvector extension not available');
  return [];
}
