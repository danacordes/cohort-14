/**
 * SLAService — runtime SLA clock engine.
 *
 * `computeDueDates` and `recalculateDueDates` accept an optional `policy`
 * object `{ responseTimeHours, resolutionTimeHours }` sourced from
 * SLAConfigService. When omitted the hard-coded defaults below are used,
 * which matches the WO-2 stub behaviour and keeps existing tests green.
 */

/** Hard-coded fallback targets (minutes) keyed by priority code. */
const DEFAULT_SLA_MINUTES = {
  CRITICAL: { response: 60,   resolution: 240  },
  HIGH:     { response: 240,  resolution: 480  },
  MEDIUM:   { response: 480,  resolution: 1440 },
  LOW:      { response: 1440, resolution: 4320 },
};

const DEFAULT_AT_RISK_FRACTION = 0.8; // 80 % of target consumed

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function targetsFromPolicy(priorityCode, policy) {
  if (policy) {
    return {
      response:   policy.responseTimeHours   * 60,
      resolution: policy.resolutionTimeHours * 60,
    };
  }
  return DEFAULT_SLA_MINUTES[priorityCode] ?? DEFAULT_SLA_MINUTES.MEDIUM;
}

// ─── Due-date computation ─────────────────────────────────────────────────────

/**
 * Compute initial SLA due dates for a new ticket.
 *
 * @param {string} priorityCode  e.g. 'HIGH'
 * @param {Date}   [now]         defaults to current time
 * @param {object} [policy]      optional { responseTimeHours, resolutionTimeHours }
 * @returns {{ responseDue: string, resolutionDue: string }}
 */
export function computeDueDates(priorityCode, now = new Date(), policy = null) {
  const targets = targetsFromPolicy(priorityCode, policy);
  return {
    responseDue:   addMinutes(now, targets.response).toISOString(),
    resolutionDue: addMinutes(now, targets.resolution).toISOString(),
  };
}

/**
 * Recalculate due dates when priority changes.
 * Resets the SLA clock to zero from the point of change and applies the
 * new policy. Prior elapsed time and breach state must be captured in the
 * audit trail by the caller before invoking this function.
 *
 * @param {string}      priorityCode
 * @param {Date}        [now]
 * @param {object|null} [policy]  optional { responseTimeHours, resolutionTimeHours }
 * @returns {{ responseDue: string, resolutionDue: string }}
 */
export function recalculateDueDates(priorityCode, now = new Date(), policy = null) {
  const targets = targetsFromPolicy(priorityCode, policy);
  return {
    responseDue:   addMinutes(now, targets.response).toISOString(),
    resolutionDue: addMinutes(now, targets.resolution).toISOString(),
  };
}

// ─── Clock pause / resume ─────────────────────────────────────────────────────

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

// ─── Breach and response stamping ────────────────────────────────────────────

/**
 * Stamp sla_responded_at when a ticket first moves to IN_PROGRESS.
 * No-ops if already stamped.
 */
export function stampRespondedAt(db, ticketId, now = new Date()) {
  const ticket = db.prepare('SELECT sla_responded_at FROM ticket WHERE id = ?').get(ticketId);
  if (!ticket || ticket.sla_responded_at) return; // already stamped
  db.prepare(
    `UPDATE ticket SET sla_responded_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(now.toISOString(), ticketId);
}

/**
 * Inspect a ticket's SLA clocks and stamp breach fields if thresholds are exceeded.
 * Both fields are immutable once set (no-op if already stamped).
 *
 * @param {object} db
 * @param {string} ticketId
 * @param {Date}   [now]
 */
export function checkAndStampBreaches(db, ticketId, now = new Date()) {
  const ticket = db.prepare(`
    SELECT sla_response_due_at, sla_resolution_due_at,
           sla_responded_at,
           sla_response_breached_at, sla_resolution_breached_at,
           sla_paused_at
    FROM ticket WHERE id = ?
  `).get(ticketId);

  if (!ticket || ticket.sla_paused_at) return; // clock is paused

  const updates = {};

  if (
    !ticket.sla_response_breached_at &&
    !ticket.sla_responded_at &&
    ticket.sla_response_due_at &&
    now > new Date(ticket.sla_response_due_at)
  ) {
    updates.sla_response_breached_at = now.toISOString();
  }

  if (
    !ticket.sla_resolution_breached_at &&
    ticket.sla_resolution_due_at &&
    now > new Date(ticket.sla_resolution_due_at)
  ) {
    updates.sla_resolution_breached_at = now.toISOString();
  }

  if (Object.keys(updates).length === 0) return;

  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  db.prepare(
    `UPDATE ticket SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).run(...Object.values(updates), ticketId);
}

// ─── Status derivation ────────────────────────────────────────────────────────

/**
 * Derive the SLA status for display.
 *
 * @param {object} ticket  row with SLA fields + optional _priorityCode
 * @param {Date}   [now]
 * @param {number} [atRiskThresholdPercent]  0–100; defaults to 80
 * @returns {'ON_TRACK'|'AT_RISK'|'BREACHED'|'PAUSED'|'UNKNOWN'}
 */
export function getSLAStatus(ticket, now = new Date(), atRiskThresholdPercent = 80) {
  if (!ticket.sla_resolution_due_at) return 'UNKNOWN';
  if (ticket.sla_paused_at) return 'PAUSED';

  const due = new Date(ticket.sla_resolution_due_at);
  const remaining = due.getTime() - now.getTime();

  if (remaining < 0) return 'BREACHED';

  const resolutionMinutes =
    (DEFAULT_SLA_MINUTES[ticket._priorityCode ?? 'MEDIUM']?.resolution ?? 1440) * 60 * 1000;

  const atRiskFraction = 1 - atRiskThresholdPercent / 100;
  if (remaining / resolutionMinutes < atRiskFraction) return 'AT_RISK';
  return 'ON_TRACK';
}
