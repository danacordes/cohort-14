/**
 * SLAService — application-layer SLA tracking.
 *
 * Full SLA policy configuration (from DB) is implemented in the
 * Build SLA Configuration & Tracking API work order. This stub uses
 * hard-coded defaults per priority so WO-2 ticket operations can
 * set due dates immediately.
 */

/** Default SLA targets in minutes, keyed by priority code. */
const DEFAULT_SLA_MINUTES = {
  CRITICAL: { response: 60, resolution: 240 },
  HIGH:     { response: 240, resolution: 480 },
  MEDIUM:   { response: 480, resolution: 1440 },
  LOW:      { response: 1440, resolution: 4320 },
};

const AT_RISK_THRESHOLD = 0.8;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Compute initial SLA due dates for a new ticket.
 *
 * @param {string} priorityCode  e.g. 'HIGH'
 * @param {Date}   [now]         defaults to current time
 * @returns {{ responseDue: string, resolutionDue: string }}
 */
export function computeDueDates(priorityCode, now = new Date()) {
  const targets = DEFAULT_SLA_MINUTES[priorityCode] ?? DEFAULT_SLA_MINUTES.MEDIUM;
  return {
    responseDue: addMinutes(now, targets.response).toISOString(),
    resolutionDue: addMinutes(now, targets.resolution).toISOString(),
  };
}

/**
 * Recalculate due dates when priority changes.
 * Preserves any paused time already elapsed.
 *
 * @param {string} priorityCode
 * @param {string} createdAt     ISO string
 * @param {string|null} slaPausedAt  ISO string or null
 * @param {Date}   [now]
 */
export function recalculateDueDates(priorityCode, createdAt, slaPausedAt, now = new Date()) {
  const targets = DEFAULT_SLA_MINUTES[priorityCode] ?? DEFAULT_SLA_MINUTES.MEDIUM;
  const created = new Date(createdAt);

  const pausedMs = slaPausedAt ? now.getTime() - new Date(slaPausedAt).getTime() : 0;
  const elapsed = now.getTime() - created.getTime() - pausedMs;
  const elapsedMin = elapsed / 60000;

  const responseRemaining = Math.max(0, targets.response - elapsedMin);
  const resolutionRemaining = Math.max(0, targets.resolution - elapsedMin);

  return {
    responseDue: addMinutes(now, responseRemaining).toISOString(),
    resolutionDue: addMinutes(now, resolutionRemaining).toISOString(),
  };
}

/**
 * Pause the SLA clock (ticket entering PENDING_USER_RESPONSE).
 */
export function pauseSLA(db, ticketId, now = new Date()) {
  db.prepare(
    `UPDATE ticket SET sla_paused_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(now.toISOString(), ticketId);
}

/**
 * Resume the SLA clock (ticket leaving PENDING_USER_RESPONSE).
 * Extends the due times by the paused duration.
 */
export function resumeSLA(db, ticketId, now = new Date()) {
  const ticket = db.prepare(
    `SELECT sla_paused_at, sla_response_due_at, sla_resolution_due_at FROM ticket WHERE id = ?`
  ).get(ticketId);

  if (!ticket || !ticket.sla_paused_at) return;

  const pausedMs = now.getTime() - new Date(ticket.sla_paused_at).getTime();

  const newResponseDue = ticket.sla_response_due_at
    ? new Date(new Date(ticket.sla_response_due_at).getTime() + pausedMs).toISOString()
    : null;
  const newResolutionDue = ticket.sla_resolution_due_at
    ? new Date(new Date(ticket.sla_resolution_due_at).getTime() + pausedMs).toISOString()
    : null;

  db.prepare(
    `UPDATE ticket
     SET sla_paused_at = NULL,
         sla_response_due_at = ?,
         sla_resolution_due_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(newResponseDue, newResolutionDue, ticketId);
}

/**
 * Derive the SLA status for display.
 *
 * @param {{ sla_resolution_due_at: string|null, sla_paused_at: string|null }} ticket
 * @param {Date} [now]
 * @returns {'ON_TRACK'|'AT_RISK'|'BREACHED'|'PAUSED'|'UNKNOWN'}
 */
export function getSLAStatus(ticket, now = new Date()) {
  if (!ticket.sla_resolution_due_at) return 'UNKNOWN';
  if (ticket.sla_paused_at) return 'PAUSED';

  const due = new Date(ticket.sla_resolution_due_at);
  const remaining = due.getTime() - now.getTime();

  if (remaining < 0) return 'BREACHED';

  const total = due.getTime() - now.getTime();
  const resolutionMinutes =
    (DEFAULT_SLA_MINUTES[ticket._priorityCode ?? 'MEDIUM']?.resolution ?? 1440) * 60 * 1000;

  if (total / resolutionMinutes < (1 - AT_RISK_THRESHOLD)) return 'AT_RISK';
  return 'ON_TRACK';
}
