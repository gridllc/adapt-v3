import { prisma } from '../../config/database.js';

export async function findSimilarQuestions(embedding: number[], topN = 5) {
  // Set query timeouts and parameters for stability
  await prisma.$executeRawUnsafe("SET LOCAL ivfflat.probes = 50");
  await prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '3000ms'");

  // Check if vector data exists before querying
  const result = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    'SELECT EXISTS (SELECT 1 FROM "question_vectors" LIMIT 1) AS exists'
  );
  const exists = result[0]?.exists || false;

  if (!exists) {
    console.log('⚠️ No vector data found, skipping KNN search');
    return [];
  }

  const vec = `[${embedding.join(',')}]`;
  return prisma.$queryRawUnsafe<any[]>(`
    SELECT q.id, q.question, q.answer,
           (qv.embedding <-> ${vec}::vector) AS distance
    FROM question_vectors qv
    JOIN questions q ON q.id = qv.question_id
    WHERE qv.embedding IS NOT NULL
    ORDER BY qv.embedding <-> ${vec}::vector
    LIMIT ${Number(topN)}
  `);
}

export async function findSimilarQuestionsScoped(
  embedding: number[],
  moduleIds: string[],
  threshold: number = 0.8,
  topN = 5
) {
  // Set query timeouts and parameters for stability
  await prisma.$executeRawUnsafe("SET LOCAL ivfflat.probes = 50");
  await prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '3000ms'");

  // Check if vector data exists before querying
  const result = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    'SELECT EXISTS (SELECT 1 FROM "question_vectors" LIMIT 1) AS exists'
  );
  const exists = result[0]?.exists || false;

  if (!exists) {
    console.log('⚠️ No vector data found, skipping scoped KNN search');
    return [];
  }

  const vec = `[${embedding.join(',')}]`;
  return prisma.$queryRawUnsafe<any[]>(`
    SELECT q.id, q.module_id as "moduleId", q.step_id as "stepId", q.question, q.answer,
           q.video_time as "videoTime", q.is_faq as "isFAQ", q.user_id as "userId", q.created_at,
           (1 - (qv.embedding <-> ${vec}::vector)) AS similarity
    FROM question_vectors qv
    JOIN questions q ON q.id = qv.question_id
    WHERE q.module_id = ANY(ARRAY[${moduleIds.map(id => `'${id}'`).join(',')}])
      AND qv.embedding IS NOT NULL
      AND (1 - (qv.embedding <-> ${vec}::vector)) >= ${threshold}
    ORDER BY qv.embedding <-> ${vec}::vector
    LIMIT ${Number(topN)}
  `);
}

export async function findSimilarQuestionsGlobal(
  embedding: number[],
  topN = 5
) {
  // Set query timeouts and parameters for stability
  await prisma.$executeRawUnsafe("SET LOCAL ivfflat.probes = 50");
  await prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '3000ms'");

  // Check if vector data exists before querying
  const result = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    'SELECT EXISTS (SELECT 1 FROM "question_vectors" LIMIT 1) AS exists'
  );
  const exists = result[0]?.exists || false;

  if (!exists) {
    console.log('⚠️ No vector data found, skipping global KNN search');
    return [];
  }

  const vec = `[${embedding.join(',')}]`;
  return prisma.$queryRawUnsafe<any[]>(`
    SELECT q.id, q.question, q.answer,
           (qv.embedding <-> ${vec}::vector) AS distance,
           (1 - (qv.embedding <-> ${vec}::vector)) AS similarity
    FROM question_vectors qv
    JOIN questions q ON q.id = qv.question_id
    WHERE qv.embedding IS NOT NULL
    ORDER BY qv.embedding <-> ${vec}::vector
    LIMIT ${Number(topN)}
  `);
}
