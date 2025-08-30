SELECT
  q.id,
  q.question,
  CASE WHEN q.id = ''q-seed-1'' THEN 0
       ELSE qv.embedding <-> (SELECT embedding FROM question_vectors WHERE "questionId"=''q-seed-1'')
  END AS dist
FROM questions q
JOIN question_vectors qv ON q.id = qv."questionId"
ORDER BY dist ASC
LIMIT 10;
