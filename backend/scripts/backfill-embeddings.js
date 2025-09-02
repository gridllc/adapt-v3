import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const toVec = a => '[' + a.join(',') + ']';

async function main() {
    for (; ;) {
        const batch = await prisma.$queryRaw`
      SELECT q.id, q.question, q.answer
      FROM "questions" q
      LEFT JOIN "question_vectors" qv ON qv.question_id = q.id
      WHERE qv.id IS NULL
      ORDER BY q."createdAt" DESC
      LIMIT 100`;
        console.log('missing batch size:', batch.length);
        if (!batch.length) break;

        const inputs = batch.map(r => `${r.question}\n\n${(r.answer || '').slice(0, 2000)}`);
        const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: inputs });

        for (let i = 0; i < batch.length; i++) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "question_vectors"(id, question_id, embedding)
         VALUES ($1,$2,$3::vector)
         ON CONFLICT (question_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
                randomUUID(), batch[i].id, toVec(resp.data[i].embedding)
            );
        }
        console.log('inserted', batch.length);
    }
    await prisma.$disconnect();
    console.log('done');
}
main().catch(e => { console.error(e); process.exit(1); });
