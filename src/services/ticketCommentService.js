import { randomUUID } from 'crypto';
import { ValidationError, ForbiddenError } from '../errors/index.js';
import { dispatch, Events } from './notificationDispatcher.js';

/**
 * Add a comment to a ticket.
 * Internal notes (is_internal = true) are restricted to agent and admin roles.
 * Immutability is enforced by DB triggers — no UPDATE or DELETE is permitted.
 *
 * @param {object} db
 * @param {{ ticketId, authorId, body, isInternal, authorRole }} params
 */
export function addComment(db, { ticketId, authorId, body, isInternal = false, authorRole }) {
  if (!body || !body.trim()) throw new ValidationError('Comment body is required');

  if (isInternal && !['agent', 'admin'].includes(authorRole)) {
    throw new ForbiddenError('Only agents and admins may post internal notes');
  }

  const ticket = db.prepare(
    `SELECT t.id, ts.code AS status_code FROM ticket t
     JOIN ticket_status ts ON ts.id = t.status_id WHERE t.id = ?`
  ).get(ticketId);
  if (!ticket) throw new ValidationError(`Ticket ${ticketId} not found`);
  if (ticket.status_code === 'CLOSED' && isInternal) {
    throw new ValidationError('Cannot add internal notes to a closed ticket');
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO ticket_comment (id, ticket_id, body, is_internal, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, ticketId, body.trim(), isInternal ? 1 : 0, authorId);

  if (!isInternal) {
    dispatch(Events.TICKET_COMMENT_ADDED, { ticketId, authorId, commentId: id });
  }

  return db.prepare('SELECT * FROM ticket_comment WHERE id = ?').get(id);
}

/**
 * Retrieve comments for a ticket, filtering internal notes for user role.
 *
 * @param {object} db
 * @param {string} ticketId
 * @param {string} role  caller's role
 */
export function getComments(db, ticketId, role) {
  if (role === 'user') {
    return db.prepare(
      `SELECT * FROM ticket_comment WHERE ticket_id = ? AND is_internal = 0
       ORDER BY created_at ASC`
    ).all(ticketId);
  }
  return db.prepare(
    `SELECT * FROM ticket_comment WHERE ticket_id = ? ORDER BY created_at ASC`
  ).all(ticketId);
}
