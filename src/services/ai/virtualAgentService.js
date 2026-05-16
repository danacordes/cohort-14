import { EMBEDDING_ENTITY_KB_ARTICLE } from '../../constants/embeddingEntities.js';
import { ValidationError } from '../../errors/index.js';
import { findSimilar } from './embeddingService.js';
import { loadKbArticleRow, mapKbArticleGraphql } from '../kb/kbArticleMgmtService.js';

/** Candidates from cosine scan before Published + threshold filtering. */
const TOP_RETRIEVE = 15;
/** Max articles included in the RAG prompt. */
const TOP_CONTEXT = 5;
/** Minimum cosine similarity to treat a hit as relevant (tuned for training data volumes). */
const MIN_SIMILARITY = 0.42;
const ARTICLE_BODY_SNIPPET_LEN = 1200;

export const VIRTUAL_AGENT_FALLBACK_ANSWER =
  'I could not find a matching published knowledge base article for your question. Try KB search or submit a ticket for help from an agent.';

export const VIRTUAL_AGENT_LLM_UNAVAILABLE_ANSWER =
  'The virtual agent is temporarily unavailable. Try KB search or submit a ticket for help from an agent.';

/** @returns {{ answer: string; sourceArticles: ReturnType<typeof mapKbArticleGraphql>[] }} */
export function virtualAgentFallbackResponse(answer = VIRTUAL_AGENT_FALLBACK_ANSWER) {
  return { answer, sourceArticles: [] };
}

function truncate(s, len) {
  const t = (s ?? '').trim();
  if (t.length <= len) return t;
  return `${t.slice(0, len - 3)}…`;
}

/**
 * @param {string} number
 * @param {string} title
 * @param {string} body
 */
function formatArticleExcerpt(number, title, body) {
  return `Article ${number}: ${title}\n${truncate(body, ARTICLE_BODY_SNIPPET_LEN)}`;
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Array<{ entityId: string; score: number }>} hits
 */
function selectPublishedContextArticles(db, hits) {
  /** @type {Array<{ row: NonNullable<ReturnType<typeof loadKbArticleRow>>; score: number }>} */
  const selected = [];
  for (const h of hits) {
    if (h.score < MIN_SIMILARITY) continue;
    const row = loadKbArticleRow(db, h.entityId);
    if (!row || row.status !== 'Published') continue;
    selected.push({ row, score: h.score });
    if (selected.length >= TOP_CONTEXT) break;
  }
  return selected;
}

/**
 * RAG answer over published KB articles (read-only, WO #38).
 *
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {import('node:sqlite').DatabaseSync} db read pool
 * @param {string} queryText
 */
export async function answerVirtualAgentQuery(llmClient, db, queryText) {
  const q = (queryText ?? '').trim();
  if (!q) throw new ValidationError('Query cannot be empty');

  const hits = await findSimilar(db, llmClient, q, EMBEDDING_ENTITY_KB_ARTICLE, TOP_RETRIEVE);
  const context = selectPublishedContextArticles(db, hits);
  if (context.length === 0) {
    return virtualAgentFallbackResponse();
  }

  const excerptBlock = context
    .map(({ row }) => formatArticleExcerpt(row.number, row.title, row.body))
    .join('\n\n---\n\n');

  const systemPrompt = `You are an IT service desk virtual agent. Answer the user's question using ONLY the published knowledge base excerpts below.
If the excerpts do not contain enough information, say so briefly and suggest submitting a ticket.
Do not invent steps, links, or article numbers not present in the excerpts.
Keep the answer concise (2–6 sentences or short bullets).`;

  const userPrompt = `User question:\n${q}\n\nKnowledge base excerpts:\n${excerptBlock}`;

  const { content } = await llmClient.generate({
    systemPrompt,
    userPrompt,
    maxTokens: 800,
  });

  const answer = String(content ?? '').trim();
  if (!answer) {
    return virtualAgentFallbackResponse();
  }

  const sourceArticles = context.map(({ row }) => mapKbArticleGraphql(db, row));
  return { answer, sourceArticles };
}
