import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/index.js';

/** Hard-coded fallback targets (hours) used when no DB policy exists. */
const DEFAULTS = {
  CRITICAL: { responseTimeHours: 1,  resolutionTimeHours: 4  },
  HIGH:     { responseTimeHours: 4,  resolutionTimeHours: 8  },
  MEDIUM:   { responseTimeHours: 8,  resolutionTimeHours: 24 },
  LOW:      { responseTimeHours: 24, resolutionTimeHours: 72 },
};

// ─── Policy CRUD ─────────────────────────────────────────────────────────────

/**
 * Return the most-recent SLAPolicy per priority level.
 * Rows are sorted by priority in display order.
 */
export function getPolicies(db) {
  return db.prepare(`
    SELECT * FROM (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY priority
          ORDER BY effective_from DESC, created_at DESC, id DESC
        ) AS rn
      FROM sla_policy
    )
    WHERE rn = 1
    ORDER BY CASE priority
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH'     THEN 2
      WHEN 'MEDIUM'   THEN 3
      WHEN 'LOW'      THEN 4
      ELSE 5
    END
  `).all();
}

/**
 * Return the active SLAPolicy for a single priority code.
 * Falls back to hard-coded defaults if no DB record exists.
 *
 * @param {object} db
 * @param {string} priorityCode  e.g. 'HIGH'
 * @returns {{ responseTimeHours: number, resolutionTimeHours: number }}
 */
export function getPolicyForPriority(db, priorityCode) {
  const row = db.prepare(`
    SELECT response_time_hours, resolution_time_hours
    FROM sla_policy
    WHERE priority = ?
    ORDER BY effective_from DESC
    LIMIT 1
  `).get(priorityCode);

  if (row) {
    return {
      responseTimeHours: row.response_time_hours,
      resolutionTimeHours: row.resolution_time_hours,
    };
  }
  // Fall back to hard-coded defaults (matches the WO-2 stub values)
  return DEFAULTS[priorityCode] ?? DEFAULTS.MEDIUM;
}

/**
 * Insert a new SLAPolicy record for a priority level.
 * Historical records are retained for audit; only the most recent is active.
 *
 * @param {object} db
 * @param {{ priority, responseTimeHours, resolutionTimeHours, createdBy }} params
 */
export function upsertPolicy(db, { priority, responseTimeHours, resolutionTimeHours, createdBy }) {
  if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    throw new ValidationError(`Invalid priority level: ${priority}`);
  }
  if (!Number.isInteger(responseTimeHours) || responseTimeHours < 1) {
    throw new ValidationError('responseTimeHours must be a positive integer');
  }
  if (!Number.isInteger(resolutionTimeHours) || resolutionTimeHours <= responseTimeHours) {
    throw new ValidationError('resolutionTimeHours must be greater than responseTimeHours');
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sla_policy (id, priority, response_time_hours, resolution_time_hours, effective_from, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, priority, responseTimeHours, resolutionTimeHours, now, createdBy, now);

  return db.prepare('SELECT * FROM sla_policy WHERE id = ?').get(id);
}

// ─── Global config ────────────────────────────────────────────────────────────

/**
 * Return the global escalation configuration.
 */
export function getGlobalConfig(db) {
  return db.prepare(
    'SELECT escalation_threshold_percent, unassigned_escalation_threshold_hours FROM sla_global_config WHERE id = 1'
  ).get();
}

/**
 * Update global escalation thresholds.
 *
 * @param {object} db
 * @param {{ escalationThresholdPercent?: number, unassignedEscalationThresholdHours?: number }} params
 */
export function updateGlobalConfig(db, { escalationThresholdPercent, unassignedEscalationThresholdHours }) {
  if (
    escalationThresholdPercent !== undefined &&
    (!Number.isInteger(escalationThresholdPercent) ||
      escalationThresholdPercent < 50 ||
      escalationThresholdPercent > 95)
  ) {
    throw new ValidationError('escalationThresholdPercent must be an integer between 50 and 95');
  }
  if (
    unassignedEscalationThresholdHours !== undefined &&
    (!Number.isInteger(unassignedEscalationThresholdHours) || unassignedEscalationThresholdHours < 1)
  ) {
    throw new ValidationError('unassignedEscalationThresholdHours must be a positive integer');
  }

  const current = getGlobalConfig(db);
  const newPercent = escalationThresholdPercent ?? current.escalation_threshold_percent;
  const newHours = unassignedEscalationThresholdHours ?? current.unassigned_escalation_threshold_hours;

  db.prepare(
    'UPDATE sla_global_config SET escalation_threshold_percent = ?, unassigned_escalation_threshold_hours = ? WHERE id = 1'
  ).run(newPercent, newHours);

  return getGlobalConfig(db);
}
