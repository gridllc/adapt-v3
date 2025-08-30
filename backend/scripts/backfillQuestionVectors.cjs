#!/usr/bin/env node
const { Client } = require("pg");
const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";

async function embed(text) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body}`);
  const data = JSON.parse(body);
  return data.data[0].embedding;
}

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY required");

  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const q = await pg.query(`
    SELECT q.id, q.question
    FROM questions q
    LEFT JOIN question_vectors qv ON q.id = qv."questionId"
    WHERE qv."questionId" IS NULL
  `);
  console.log("To backfill:", q.rowCount);

  for (const row of q.rows) {
    console.log("Embedding:", row.id);
    const vec = await embed(row.question);
    console.log(" -> vector len", vec.length);
    await pg.query(
      `INSERT INTO question_vectors ("questionId", embedding)
       VALUES ($1, $2::vector)
       ON CONFLICT ("questionId") DO UPDATE SET embedding = EXCLUDED.embedding`,
      [row.id, '[' + vec.join(',') + ']']
    );
    console.log(" ? upserted", row.id);
  }

  const c = await pg.query(`SELECT COUNT(*)::int AS n FROM question_vectors WHERE embedding IS NOT NULL;`);
  console.log("Total vectors now:", c.rows[0].n);
  await pg.end();
  console.log("Done.");
})().catch(e => { console.error(e); process.exit(1); });
