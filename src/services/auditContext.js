import { randomUUID } from 'crypto';

/**
 * Append an immutable audit entry for a state-changing operation.
 * Must be called inside the same write transaction as the mutation.
 *
 * @param {import('node:sqlite').DatabaseSync} db  - write connection
 * @param {{ entityType: string, entityId: string, action: string,
 *            actorId: string, previousValues?: object, newValues?: object }} entry
 */
export function audit(db, { entityType, entityId, action, actorId, previousValues = {}, newValues = {} }) {
  // Soft-fail per ADR-001: a failed audit write must not roll back the domain transaction.
  try {
    db.prepare(
      `INSERT INTO audit_entries
         (id, entity_type, entity_id, action, actor_id, previous_values, new_values, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      randomUUID(),
      entityType,
      entityId,
      action,
      actorId,
      JSON.stringify(previousValues),
      JSON.stringify(newValues),
    );
  } catch (err) {
    console.error('[AuditContext] Failed to write audit entry:', err.message, {
      entityType, entityId, action, actorId,
    });
  }
}
