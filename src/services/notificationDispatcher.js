/**
 * NotificationDispatcher — event dispatch stub.
 *
 * Full email and in-app delivery is implemented in the Notifications work order.
 * This stub wires the correct call sites so resolvers are production-ready from day one.
 * In development it logs events to stdout; in production it emits structured JSON.
 */

export const Events = {
  TICKET_CREATED: 'ticket.created',
  TICKET_STATUS_CHANGED: 'ticket.status_changed',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_REASSIGNED: 'ticket.reassigned',
  TICKET_COMMENT_ADDED: 'ticket.comment_added',
  TICKET_PRIORITY_CHANGED: 'ticket.priority_changed',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_CLOSED: 'ticket.closed',

  KB_ARTICLE_TICKET_LINK_STALE: 'kb.article_ticket_link_stale',
  KB_ARTICLE_REJECTED_FOR_AUTHOR: 'kb.article_rejected_for_author',
  KB_ARTICLE_REVIEW_DUE: 'kb.article_review_due',
};

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Dispatch a notification event.
 * Fire-and-forget — never throws; errors are swallowed and logged.
 *
 * @param {string} event   One of Events.*
 * @param {object} payload Arbitrary event data (ticketId, submitterId, etc.)
 */
export function dispatch(event, payload = {}) {
  try {
    if (isDev) {
      console.log(`[NotificationDispatcher] ${event}`, payload);
    } else {
      console.log(JSON.stringify({
        level: 'info',
        type: 'notification_event',
        event,
        payload,
        timestamp: new Date().toISOString(),
      }));
    }
  } catch {
    // Never let notification logging crash the request
  }
}
