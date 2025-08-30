import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// pick your embedding model (matches your default in DB)
const EMB_MODEL = "text-embedding-3-small";

async function embed(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({ model: EMB_MODEL, input: text });
  return r.data[0].embedding;
}

async function main() {
  // find questions with no vector row or NULL embedding
  const missing = await prisma.$queryRaw<any[]>`
    SELECT q.id, q.question, q.answer
    FROM questions q
    LEFT JOIN question_vectors qv ON qv."questionId" = q.id
    WHERE qv.id IS NULL OR qv.embedding IS NULL
    LIMIT 500
  `;

  console.log("To backfill:", missing.length);

  for (const q of missing) {
    const text = [q.question ?? "", q.answer ?? ""].join("\n").trim();
    if (!text) continue;

    const e = await embed(text);

    // upsert into question_vectors (embedding is pgvector column now)
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO question_vectors ("id","questionId","embedding","modelName","createdAt")
      VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
      ON CONFLICT ("questionId")
      DO UPDATE SET embedding = EXCLUDED.embedding, "modelName" = EXCLUDED."modelName";
      `,
      q.id,
      // pg accepts vector via text literal like '[1,2,3]'
      `[${e.join(",")}]`,
      EMB_MODEL
    );

    console.log("Vectored:", q.id);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
