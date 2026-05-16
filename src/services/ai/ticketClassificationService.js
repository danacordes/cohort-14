import { findSimilar } from './embeddingService.js';
import { EMBEDDING_ENTITY_TICKET } from '../../constants/embeddingEntities.js';
import { ValidationError } from '../../errors/index.js';
import { ticketEmbeddingText } from './ticketEmbedding.js';

const TOP_SIMILAR = 8;
const EXAMPLE_BODY_LEN = 400;

function truncate(s, len) {
  const t = (s ?? '').trim();
  if (t.length <= len) return t;
  return `${t.slice(0, len - 3)}…`;
}

/**
 * @param {{ id: string; title: string; description: string; category_id: string; category_name: string }} row
 */
function formatExample(row) {
  const body = `Title:\n${truncate(row.title, 200)}\n\nDescription:\n${truncate(row.description ?? '', EXAMPLE_BODY_LEN)}`;
  return `Example (${row.category_name}):\n${body}\n`;
}

/**
 * @param {string[]} orderedIds similarity order from {@link findSimilar}
 * @param {Array<{ id: string }>} rows hydrated ticket rows keyed by id
 */
function rowsInSimilarityOrder(orderedIds, rows) {
  /** @type {Map<string, any>} */
  const byId = new Map(rows.map((r) => [r.id, r]));
  return orderedIds.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
}

/**
 * @param {import('node:sqlite').DatabaseSync} db read pool
 */
function fetchActiveCategories(db) {
  return db
    .prepare(`SELECT id, name FROM ticket_category WHERE is_active = 1 ORDER BY name ASC`)
    .all();
}

function extractSuggestionJson(llmRaw) {
  const start = llmRaw.indexOf('{');
  const end = llmRaw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(llmRaw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampConfidence(n) {
  if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  return 0;
}

/**
 * @typedef {{ categoryId: string; categoryName: string; confidence: number }} CategorySuggestionResult
 */

/**
 * Few-shot RAG category suggestion. Uses DB-backed categories — returned name is canonical.
 *
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {import('node:sqlite').DatabaseSync} db read pool
 */
export async function suggestTicketCategoryFromText(llmClient, db, title, description) {
  const t = (title ?? '').trim();
  if (!t) throw new ValidationError('Title is required');
  const d = description ?? '';

  const categories = fetchActiveCategories(db);
  if (categories.length === 0) {
    throw new ValidationError('No active categories configured');
  }

  const blobText = ticketEmbeddingText(t, d);
  if (!blobText.trim()) {
    throw new ValidationError('Ticket text cannot be empty');
  }

  const hits = await findSimilar(db, llmClient, blobText, EMBEDDING_ENTITY_TICKET, TOP_SIMILAR);
  const ids = hits.map((h) => h.entityId).filter(Boolean);
  /** @type {Array<{ id: string; category_id: string; category_name: string; title: string; description: string }>} */
  const rowsRaw =
    ids.length === 0
      ? []
      : db.prepare(
          `SELECT t.id,
                  t.category_id AS category_id,
                  tc.name AS category_name,
                  t.title AS title,
                  t.description AS description
           FROM ticket t
           INNER JOIN ticket_category tc ON tc.id = t.category_id
           WHERE t.id IN (${ids.map(() => '?').join(', ')})
             AND tc.is_active = 1`
        ).all(...ids);

  const examples = rowsInSimilarityOrder(ids, rowsRaw);
  let catBullet = '';
  for (const c of categories) {
    catBullet += `- ${c.id} — ${c.name}\n`;
  }

  /** @type {string} */
  let exampleBlock =
    examples.length === 0
      ? ''
      : `\nPreviously categorized similar tickets (${examples.length}):\n${examples.map(formatExample).join('\n')}`;

  const systemPrompt =
    `You classify IT service desk tickets into one canonical category drawn ONLY from Allowed categories IDs.

Reply with ONLY a compact JSON object and no prose:
{"categoryId":"<exact-id-from-list>","categoryName":"<exact-name-from-row>","confidence":<number between 0 and 1>}
Use high confidence (>0.7) only when strongly supported.${examples.length ? ' Prefer categories seen in labeled examples when content matches.' : ''}`;

  const userPrompt = `Allowed categories:
${catBullet}${exampleBlock}

New ticket (to classify):

Title:
${truncate(t, 280)}

Description:
${truncate(d, 2800)}
`;

  const { content } = await llmClient.generate({
    systemPrompt,
    userPrompt,
    maxTokens: 384,
  });

  const parsed = extractSuggestionJson((content ?? '').trim());
  if (!parsed || typeof parsed.categoryId !== 'string') {
    throw new ValidationError('Classification model returned no parseable suggestion');
  }

  const canon = db.prepare('SELECT id, name FROM ticket_category WHERE id = ? AND is_active = 1').get(parsed.categoryId);
  if (!canon) {
    throw new ValidationError('Classification model referenced an unknown category');
  }

  const confidence = clampConfidence(Number(parsed.confidence));

  return {
    categoryId: canon.id,
    categoryName: canon.name,
    confidence,
  };
}
