import { randomUUID } from 'crypto';
import { SYSTEM_AI_USER_ID } from '../constants/systemUsers.js';

/**
 * Append an immutable audit entry for a state-changing operation.
 * Must be called inside the same write transaction as the mutation.
 *
 * For AI-attributed actions, pass `actorKind: 'ai_system'`; `actorId` is coerced
 * to {@link SYSTEM_AI_USER_ID} for `users` FK integrity.
 *
 * @param {import('node:sqlite').DatabaseSync} db  - write connection
 * @param {{ entityType: string, entityId: string, action: string,
 *            actorId: string, previousValues?: object, newValues?: object,
 *            actorKind?: 'human' | 'ai_system', aiConfidence?: number | null,
 *            aiFeature?: string | null }} entry
 */
export function audit(
  db,
  {
    entityType,
    entityId,
    action,
    actorId,
    previousValues = {},
    newValues = {},
    actorKind = 'human',
    aiConfidence = null,
    aiFeature = null,
  }
) {
  const kind = actorKind === 'ai_system' ? 'ai_system' : 'human';
  const resolvedActorId = kind === 'ai_system' ? SYSTEM_AI_USER_ID : actorId;

  // Soft-fail per ADR-001: a failed audit write must not roll back the domain transaction.
  try {
    db.prepare(
      `INSERT INTO audit_entries
         (id, entity_type, entity_id, action, actor_id, previous_values, new_values, occurred_at,
          actor_kind, ai_confidence, ai_feature)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`
    ).run(
      randomUUID(),
      entityType,
      entityId,
      action,
      resolvedActorId,
      JSON.stringify(previousValues),
      JSON.stringify(newValues),
      kind,
      aiConfidence == null ? null : aiConfidence,
      aiFeature == null ? null : aiFeature
    );
  } catch (err) {
    console.error('[AuditContext] Failed to write audit entry:', err.message, {
      entityType, entityId, action, actorId: resolvedActorId, actorKind: kind,
    });
  }
}

/**
 * Record an AI-attributed audit row (same immutability rules as {@link audit}).
 * Future AI feature services should call this instead of guessing actor IDs.
 */
export function auditAiAction(db, params) {
  const { aiConfidence, aiFeature, ...rest } = params;
  return audit(db, {
    ...rest,
    actorKind: 'ai_system',
    aiConfidence: aiConfidence == null ? null : aiConfidence,
    aiFeature: aiFeature == null ? null : aiFeature,
  });
}
