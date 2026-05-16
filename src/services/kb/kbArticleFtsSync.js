/**
 * Maintains FTS5 kb_article_fts rows for WO-12 search.
 * WO-13 mutations should invoke {@link rebuildKbArticleFts} after article changes.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} articleId
 */

function attachmentExtractsJoined(db, articleId) {
  const rows = db
    .prepare(
      `SELECT extracted_text FROM kb_article_attachment WHERE article_id = ?
       ORDER BY uploaded_at ASC`
    )
    .all(articleId);
  /** @type {string[]} */
  const parts = [];
  for (const r of rows) {
    const t = (r.extracted_text ?? '').trim();
    if (t) parts.push(t);
  }
  return parts.join('\n');
}

/** @returns {string[]} */
export function parseKbTags(tagsJsonRaw) {
  try {
    const v = JSON.parse(tagsJsonRaw ?? '[]');
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/**
 * Upsert FTS row from canonical tables (WO-13 will call post-mutation).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} articleId
 */
export function rebuildKbArticleFts(db, articleId) {
  const row = db
    .prepare(
      `SELECT a.id AS id,
              a.title AS title,
              a.body AS body,
              a.tags_json AS tags_json,
              c.name AS category_name
       FROM kb_article a
       INNER JOIN kb_category c ON c.id = a.category_id AND c.is_active = 1
       WHERE a.id = ?`
    )
    .get(articleId);
  db.prepare(`DELETE FROM kb_article_fts WHERE article_id = ?`).run(articleId);
  if (!row) return;
  const tags = parseKbTags(row.tags_json);
  const attachBlock = attachmentExtractsJoined(db, articleId);
  const docSegments = [
    row.title,
    row.body ?? '',
    tags.join(' '),
    row.category_name ?? '',
    attachBlock,
  ].filter((s) => (s ?? '').trim().length > 0);

  db.prepare(`INSERT INTO kb_article_fts (article_id, title, doc) VALUES (?, ?, ?)`).run(
    row.id,
    row.title,
    docSegments.join('\n'),
  );
}

/** Recompute every article FTS row — dev/seed tooling only O(n²) attachment reads acceptable. */
export function rebuildAllKbArticleFts(db) {
  const ids = db.prepare(`SELECT id FROM kb_article`).all().map((r) => r.id);
  for (const id of ids) rebuildKbArticleFts(db, id);
}
