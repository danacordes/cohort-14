import { NotFoundError } from '../../errors/index.js';

const THREAD_CHAR_BUDGET = 14_000;

function truncate(s, budget) {
  const t = s ?? '';
  if (t.length <= budget) return t;
  return `${t.slice(0, budget - 3)}…`;
}

function labelFor(internal) {
  return internal ? 'Internal note' : 'Comment';
}

/**
 * Build plaintext digest for Claude summarization calls.
 *
 * @param {import('node:sqlite').DatabaseSync} db read pool
 */
export function buildTicketThreadDigest(db, ticketId) {
  /** @type {any} */
  const t = db
    .prepare(
      `SELECT title, description, resolution_summary FROM ticket WHERE id = ?`
    )
    .get(ticketId);
  if (!t) throw new NotFoundError(`Ticket ${ticketId} not found`);

  const comments = db
    .prepare(
      `SELECT c.body,
              c.is_internal AS is_internal,
              c.created_at AS created_at,
              COALESCE(u.email, c.author_id) AS author
       FROM ticket_comment c
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(ticketId);

  /** @type {string[]} */
  const parts = [];
  parts.push(`Title:\n${t.title}`);
  parts.push('');
  parts.push(`Description:\n${t.description ?? ''}`);
  parts.push('');
  if (t.resolution_summary?.trim()) {
    parts.push(`Resolution summary:\n${t.resolution_summary}`);
    parts.push('');
  }
  parts.push(`Comments (${comments.length}):\n`);

  if (comments.length === 0) {
    parts.push('(none)');
  } else {
    for (const c of comments) {
      parts.push(`[${labelFor(Boolean(c.is_internal))} • ${c.author} • ${c.created_at}]`);
      parts.push(`${c.body ?? ''}`);
      parts.push('');
    }
  }

  return truncate(parts.join('\n'), THREAD_CHAR_BUDGET).trimEnd();
}

/**
 * @param {import('./llmClient.js').LLMClient} llmClient
 * @param {import('node:sqlite').DatabaseSync} db read pool
 */
export async function summarizeTicketThread(llmClient, db, ticketId) {
  const digest = buildTicketThreadDigest(db, ticketId);
  const { content } = await llmClient.generate({
    systemPrompt:
      'Summarize IT service desk ticket threads clearly and concisely in 3–6 bullet-style sentences covering the reported issue, what was tried, resolutions, blockers if any, and current state.',
    userPrompt: `Produce a neutral summary suitable for handoff to another agent:\n\n${digest}`,
    maxTokens: 600,
  });
  return String(content ?? '').trim();
}
