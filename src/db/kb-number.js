/**
 * Allocate KB-0001 style numbers via kb_article_number_seq.
 * Caller should run inside `BEGIN IMMEDIATE` when mutating concurrently.
 */
export function reserveNextKbArticleNumber(db) {
  const row = db
    .prepare(
      `UPDATE kb_article_number_seq
       SET next_seq = next_seq + 1
       WHERE id = 1
       RETURNING next_seq AS n`
    )
    .get();
  if (row == null || row.n == null) {
    throw new Error('kb_article_number_seq row missing (id=1)');
  }
  return `KB-${String(row.n).padStart(4, '0')}`;
}
