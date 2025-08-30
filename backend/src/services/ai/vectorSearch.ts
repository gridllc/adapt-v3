import { prisma } from '../../config/database.js';

export async function findSimilarQuestions(embedding: number[], topN = 5) {
  const vec = `[${embedding.join(',')}]`;
  return prisma.$queryRawUnsafe<any[]>(`
    SELECT q.id, q.question, q.answer,
           (qv.embedding <-> ${vec}::vector) AS distance
    FROM question_vectors qv
    JOIN questions q ON q.id = qv."questionId"
    WHERE qv.embedding IS NOT NULL
    ORDER BY qv.embedding <-> ${vec}::vector
    LIMIT ${Number(topN)}
  `);
}

/**
 * Enhanced version with module scoping and similarity threshold
 */
export async function findSimilarQuestionsScoped(
  embedding: number[],
  moduleIds: string[],
  threshold: number = 0.8,
  topN = 5
) {
  const vec = `[${embedding.join(',')}]`;
  return prisma.$queryRawUnsafe<any[]>(`
    SELECT q.id, q."moduleId", q."stepId", q.question, q.answer,
           q."videoTime", q."isFAQ", q."userId", q."createdAt",
           (1 - (qv.embedding <-> ${vec}::vector)) AS similarity
    FROM question_vectors qv
    JOIN questions q ON q.id = qv."questionId"
    WHERE q."moduleId" = ANY(ARRAY[${moduleIds.map(id => `'${id}'`).join(',')}])
      AND qv.embedding IS NOT NULL
      AND (1 - (qv.embedding <-> ${vec}::vector)) >= ${threshold}
    ORDER BY qv.embedding <-> ${vec}::vector
    LIMIT ${Number(topN)}
  `);
}

/**
 * Simple vector search without module filtering
 */
export async function findSimilarQuestionsGlobal(
  embedding: number[],
  topN = 5
) {
  const vec = `[${embedding.join(',')}]`;
  return prisma.$queryRawUnsafe<any[]>(`
    SELECT q.id, q.question, q.answer,
           (qv.embedding <-> ${vec}::vector) AS distance,
           (1 - (qv.embedding <-> ${vec}::vector)) AS similarity
    FROM question_vectors qv
    JOIN questions q ON q.id = qv."questionId"
    WHERE qv.embedding IS NOT NULL
    ORDER BY qv.embedding <-> ${vec}::vector
    LIMIT ${Number(topN)}
  `);
}
