import { parseKbTags } from './kbArticleFtsSync.js';

const MAX_QUERY_LEN = 380;

/** @typedef {{ categoryId?: string | null; articleType?: string | null; status?: string | null; updatedAfter?: string | null; updatedBefore?: string | null }} KBSearchFilters */

export function tokenizeKbQuery(raw) {
  const s = (raw ?? '').slice(0, MAX_QUERY_LEN);
  /** @type {string[]} */
  const out = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;
  let m;
  while ((m = re.exec(s)) !== null && out.length < 24) {
    const t = m[0].toLowerCase();
    if (t.length <= 72) out.push(t);
  }
  return out;
}

export function buildFtsClause(tokens) {
  if (tokens.length === 0) return null;
  return tokens
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' AND ');
}

export function kbHasStructuralFilters(filters) {
  if (!filters) return false;
  return Boolean(
    filters.categoryId?.trim() ||
      filters.articleType?.trim() ||
      filters.status?.trim() ||
      filters.updatedAfter?.trim() ||
      filters.updatedBefore?.trim(),
  );
}

export function sanitizeKbFiltersForRole(role, filters) {
  if (role !== 'user') return filters ?? {};
  const next = { ...(filters ?? {}) };
  delete next.status;
  return next;
}

export function kbWhereClausesAndParams(role, filters) {
  /** @type {string[]} */
  const clauses = [`a.status NOT IN ('Retired','Archived','Expired')`];
  /** @type {unknown[]} */
  const params = [];
  const f = filters ?? {};

  if (role === 'user') clauses.push(`a.status = 'Published'`);
  else if (role === 'agent' || role === 'admin') {
    const st = f.status?.trim();
    if (st) {
      clauses.push('a.status = ?');
      params.push(st);
    } else {
      clauses.push(`a.status = 'Published'`);
    }
  } else {
    clauses.push(`a.status = 'Published'`);
  }

  if (f.categoryId?.trim()) {
    clauses.push('a.category_id = ?');
    params.push(f.categoryId.trim());
  }
  if (f.articleType?.trim()) {
    clauses.push('a.article_type = ?');
    params.push(f.articleType.trim());
  }
  if (f.updatedAfter?.trim()) {
    clauses.push(`datetime(a.updated_at) >= datetime(?)`);
    params.push(f.updatedAfter.trim());
  }
  if (f.updatedBefore?.trim()) {
    clauses.push(`datetime(a.updated_at) <= datetime(?)`);
    params.push(f.updatedBefore.trim());
  }

  return { clauses, params };
}

export function suggestKbTerms(db, tokens) {
  const out = new Set();
  for (const t of tokens.slice(0, 2)) {
    if (!t || t.length < 2) continue;
    const like = `%${t}%`;
    const cats = db
      .prepare(
        `SELECT name FROM kb_category WHERE is_active = 1 AND name LIKE ?
         COLLATE NOCASE LIMIT 6`,
      )
      .all(like);
    for (const c of cats) out.add(c.name);
    const tagRows = db
      .prepare(
        `SELECT DISTINCT j.value AS value FROM kb_article a, json_each(a.tags_json) AS j
         WHERE json_valid(a.tags_json)
         AND a.status NOT IN ('Retired','Archived','Expired')
         AND typeof(j.value) = 'text' AND lower(j.value) LIKE lower(?)
         LIMIT 10`,
      )
      .all(like);
    for (const r of tagRows) out.add(String(r.value));
  }
  return [...out].slice(0, 8);
}

function mapKbRowToHit(row, excerptOverride) {
  const tags = parseKbTags(row.tags_json ?? '[]');
  const excerptRaw = excerptOverride ?? row.excerpt ?? '';
  const excerpt = String(excerptRaw).trim().slice(0, 500);
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    articleType: row.article_type,
    status: row.status,
    category: { id: row.category_id, name: row.category_name },
    tags,
    excerpt: excerpt.length > 0 ? excerpt : `${row.title}`.slice(0, 200),
    updatedAt: row.updated_at,
    author:
      row.author_id && row.author_email
        ? { id: row.author_id, email: row.author_email }
        : null,
  };
}

/** @typedef {{ items: Record<string, unknown>[]; totalCount: number; page: number; pageSize: number; suggestions: string[] }} KBSearchResult */

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ query?: string | null; filters?: KBSearchFilters | null; page?: { page?: number | null; pageSize?: number | null } | null; role: string }} args
 */
export function kbSearchArticles(db, args) {
  const role = args.role;
  /** @type {{ page?: number | null; pageSize?: number | null }} */
  const pageRoot =
    typeof args.page === 'object' && args.page !== null ? args.page : {};
  const pageNum = Math.max(1, pageRoot.page ?? 1);
  const pageSizeCap = Math.min(100, Math.max(1, pageRoot.pageSize ?? 25));
  const offset = (pageNum - 1) * pageSizeCap;

  const filters = sanitizeKbFiltersForRole(role, args.filters ?? undefined);
  const trimmed = (args.query ?? '').trim();
  const tokens = tokenizeKbQuery(trimmed);
  const hasTokens = tokens.length > 0;

  if (!hasTokens && !kbHasStructuralFilters(filters)) {
    return {
      items: [],
      totalCount: 0,
      page: pageNum,
      pageSize: pageSizeCap,
      suggestions: [],
    };
  }

  const whereBundle = kbWhereClausesAndParams(role, filters);
  const whereSql = whereBundle.clauses.join(' AND ');
  const whereParams = whereBundle.params;

  if (!hasTokens) {
    const countRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM kb_article a
         INNER JOIN kb_category c ON c.id = a.category_id
         LEFT JOIN users u ON u.id = a.author_id
         WHERE ${whereSql}`,
      )
      .get(...whereParams);
    /** @type {{ cnt: number }} */
    const cr = /** @type {any} */ (countRow);
    const totalCount = Number(cr.cnt ?? 0);
    /** @type {any[]} */
    const rowsRaw = db
      .prepare(
        `SELECT a.id, a.number, a.title, a.article_type AS article_type, a.status AS status,
                a.category_id AS category_id, c.name AS category_name,
                a.tags_json AS tags_json, a.updated_at AS updated_at,
                a.author_id AS author_id, u.email AS author_email,
                substr(
                  trim(COALESCE(a.title, ''))
                    || CASE WHEN trim(COALESCE(a.body, '')) <> '' THEN char(32) ELSE '' END
                    || substr(trim(COALESCE(a.body, '')), 1, 360),
                  1,
                  480
                ) AS excerpt
         FROM kb_article a
         INNER JOIN kb_category c ON c.id = a.category_id
         LEFT JOIN users u ON u.id = a.author_id
         WHERE ${whereSql}
         ORDER BY datetime(a.updated_at) DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...whereParams, pageSizeCap, offset);

    const items = rowsRaw.map((r) => mapKbRowToHit(r, r.excerpt));
    let suggestions = [];
    if (totalCount === 0 && trimmed.length > 0) suggestions = suggestKbTerms(db, tokens);
    return { items, totalCount, page: pageNum, pageSize: pageSizeCap, suggestions };
  }

  const ftsClause = buildFtsClause(tokens);
  if (!ftsClause) {
    const suggestions = trimmed.length > 0 ? suggestKbTerms(db, tokens) : [];
    return {
      items: [],
      totalCount: 0,
      page: pageNum,
      pageSize: pageSizeCap,
      suggestions,
    };
  }

  try {
    const countStmt = `
      SELECT COUNT(DISTINCT a.id) AS cnt
      FROM kb_article_fts
      INNER JOIN kb_article a ON a.id = kb_article_fts.article_id
      INNER JOIN kb_category c ON c.id = a.category_id
      LEFT JOIN users u ON u.id = a.author_id
      WHERE kb_article_fts MATCH ? AND (${whereSql})
    `;
    const cntRow = db.prepare(countStmt).get(ftsClause, ...whereParams);
    const totalCount = Number(/** @type {any} */ (cntRow).cnt ?? 0);

    const listStmt = `
      SELECT DISTINCT
        a.id, a.number, a.title, a.article_type AS article_type, a.status AS status,
        a.category_id AS category_id, c.name AS category_name,
        a.tags_json AS tags_json, a.updated_at AS updated_at,
        a.author_id AS author_id, u.email AS author_email,
        trim(
          CASE WHEN snippet(kb_article_fts, 1, '{kb:', ':kb}', ' … ', 16) <> ''
               THEN snippet(kb_article_fts, 1, '{kb:', ':kb}', ' … ', 16) ELSE '' END
          || CASE WHEN snippet(kb_article_fts, 2, '{kb:', ':kb}', ' … ', 32) <> ''
                  THEN snippet(kb_article_fts, 2, '{kb:', ':kb}', ' … ', 32) ELSE '' END
        ) AS excerpt
      FROM kb_article_fts
      INNER JOIN kb_article a ON a.id = kb_article_fts.article_id
      INNER JOIN kb_category c ON c.id = a.category_id
      LEFT JOIN users u ON u.id = a.author_id
      WHERE kb_article_fts MATCH ? AND (${whereSql})
      ORDER BY bm25(kb_article_fts) ASC, datetime(a.updated_at) DESC
      LIMIT ? OFFSET ?
    `;

    /** @type {any[]} */
    const rowsRaw = db
      .prepare(listStmt)
      .all(ftsClause, ...whereParams, pageSizeCap, offset);

    const items = rowsRaw.map((r) => mapKbRowToHit(r, r.excerpt));
    let suggestions = [];
    if (totalCount === 0 && hasTokens) suggestions = suggestKbTerms(db, tokens);
    return { items, totalCount, page: pageNum, pageSize: pageSizeCap, suggestions };
  } catch {
    return {
      items: [],
      totalCount: 0,
      page: pageNum,
      pageSize: pageSizeCap,
      suggestions: trimmed.length > 0 ? suggestKbTerms(db, tokens) : [],
    };
  }
}

