import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/index.js';

/**
 * Record a KB self-resolution deflection event.
 * Called when a user clicks "My issue is resolved" on the KB deflection panel
 * without submitting a ticket.
 *
 * @param {object} db
 * @param {{ userId: string, articleId: string, queryText?: string }} params
 * @returns {object} the inserted deflection event
 */
export function recordDeflection(db, { userId, articleId, queryText = '' }) {
  if (!userId) throw new ValidationError('userId is required for deflection event');
  if (!articleId) throw new ValidationError('articleId is required for deflection event');

  const id = randomUUID();
  db.prepare(
    `INSERT INTO deflection_event (id, user_id, article_id, query_text, occurred_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, userId, articleId, queryText);

  return db.prepare('SELECT * FROM deflection_event WHERE id = ?').get(id);
}

/**
 * List deflection events for reporting (admin only).
 */
export function listDeflectionEvents(db, { userId, limit = 100, offset = 0 } = {}) {
  if (userId) {
    return db.prepare(
      `SELECT * FROM deflection_event WHERE user_id = ? ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
    ).all(userId, limit, offset);
  }
  return db.prepare(
    `SELECT * FROM deflection_event ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);
}
