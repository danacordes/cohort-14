import { EMBEDDING_ENTITY_KB_ARTICLE } from '../../constants/embeddingEntities.js';
import { storeEmbedding } from './embeddingService.js';

/**
 * Concatenated embedding text for KB semantic retrieval (WO #38).
 *
 * @param {string | null | undefined} title
 * @param {string | null | undefined} body
 */
export function kbArticleEmbeddingText(title, body) {
  const t = (title ?? '').trim();
  const b = (body ?? '').trim();
  const parts = [t ? `Title:\n${t}` : '', b ? `Body:\n${b}` : ''].filter(Boolean);
  return parts.join('\n\n');
}

/**
 * Best-effort: never throws. Logs JSON line on failure per non-fatal AI contract.
 *
 * @param {import('node:sqlite').DatabaseSync} db write pool
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {string} articleId
 * @param {string | null | undefined} title
 * @param {string | null | undefined} body
 */
export async function persistKbArticleEmbeddingNonFatal(
  db,
  llmClient,
  articleId,
  title,
  body,
) {
  try {
    const blobText = kbArticleEmbeddingText(title, body);
    if (!blobText.trim()) return;
    const vec = await llmClient.embed(blobText);
    storeEmbedding(db, {
      entityType: EMBEDDING_ENTITY_KB_ARTICLE,
      entityId: articleId,
      vector: vec,
    });
  } catch (err) {
    const msg = typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err);
    console.error(
      JSON.stringify({
        level: 'warn',
        msg: 'kb_article_embedding_failed',
        articleId,
        error: msg.slice(0, 500),
      }),
    );
  }
}
