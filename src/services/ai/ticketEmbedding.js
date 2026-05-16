import { EMBEDDING_ENTITY_TICKET } from '../../constants/embeddingEntities.js';
import { storeEmbedding } from './embeddingService.js';

/**
 * Concatenated embedding text stored for cosine retrieval with new ticket text queries.
 *
 * @param {string | null | undefined} title
 * @param {string | null | undefined} description
 */
export function ticketEmbeddingText(title, description) {
  const t = (title ?? '').trim();
  const d = (description ?? '').trim();
  const parts = [t ? `Title:\n${t}` : '', d ? `Description:\n${d}` : ''].filter(Boolean);
  return parts.join('\n\n');
}

/**
 * Best-effort: never throws. Logs JSON line on failure per non-fatal AI contract (WO #37).
 *
 * @param {import('node:sqlite').DatabaseSync} db write pool
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {string} ticketId
 */
export async function persistTicketEmbeddingNonFatal(db, llmClient, ticketId, title, description) {
  try {
    const blobText = ticketEmbeddingText(title, description);
    if (!blobText.trim()) return;
    const vec = await llmClient.embed(blobText);
    storeEmbedding(db, {
      entityType: EMBEDDING_ENTITY_TICKET,
      entityId: ticketId,
      vector: vec,
    });
  } catch (err) {
    const msg = typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err);
    console.error(JSON.stringify({
      level: 'warn',
      msg: 'ticket_embedding_failed',
      ticketId,
      error: msg.slice(0, 500),
    }));
  }
}
