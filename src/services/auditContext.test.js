import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { audit, auditAiAction } from './auditContext.js';
import { SYSTEM_AI_USER_ID } from '../constants/systemUsers.js';

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE audit_entries (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      previous_values TEXT NOT NULL DEFAULT '{}',
      new_values TEXT NOT NULL DEFAULT '{}',
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor_kind TEXT NOT NULL DEFAULT 'human' CHECK (actor_kind IN ('human', 'ai_system')),
      ai_confidence REAL,
      ai_feature TEXT
    );

    CREATE TRIGGER audit_entries_no_update
    BEFORE UPDATE ON audit_entries
    BEGIN
      SELECT RAISE(ABORT, 'audit_entries are immutable');
    END;

    CREATE TRIGGER audit_entries_no_delete
    BEFORE DELETE ON audit_entries
    BEGIN
      SELECT RAISE(ABORT, 'audit_entries are append-only');
    END;
  `);
  return db;
}

describe('audit()', () => {
  let db;

  before(() => {
    db = createTestDb();
  });

  after(() => {
    db.close();
  });

  it('inserts an audit entry with the correct fields', () => {
    audit(db, {
      entityType: 'Ticket',
      entityId: 'ticket-uuid-1',
      action: 'created',
      actorId: 'user-uuid-1',
      previousValues: {},
      newValues: { status: 'OPEN' },
    });

    const row = db.prepare('SELECT * FROM audit_entries WHERE entity_id = ?').get('ticket-uuid-1');
    assert.ok(row, 'row should exist');
    assert.equal(row.entity_type, 'Ticket');
    assert.equal(row.entity_id, 'ticket-uuid-1');
    assert.equal(row.action, 'created');
    assert.equal(row.actor_id, 'user-uuid-1');
    assert.equal(row.new_values, JSON.stringify({ status: 'OPEN' }));
    assert.match(row.id, /^[0-9a-f-]{36}$/);
    assert.equal(row.actor_kind, 'human');
  });

  it('records AI-attributed audits with system actor and metadata', () => {
    auditAiAction(db, {
      entityType: 'Ticket',
      entityId: 'ticket-ai-1',
      action: 'category_suggested',
      actorId: 'ignored',
      previousValues: {},
      newValues: { categoryId: 'c1' },
      aiConfidence: 0.91,
      aiFeature: 'classification',
    });
    const row = db.prepare('SELECT * FROM audit_entries WHERE entity_id = ?').get('ticket-ai-1');
    assert.equal(row.actor_id, SYSTEM_AI_USER_ID);
    assert.equal(row.actor_kind, 'ai_system');
    assert.equal(row.ai_confidence, 0.91);
    assert.equal(row.ai_feature, 'classification');
  });

  it('inserts multiple entries for the same entity', () => {
    audit(db, {
      entityType: 'Ticket',
      entityId: 'ticket-uuid-2',
      action: 'created',
      actorId: 'user-1',
    });
    audit(db, {
      entityType: 'Ticket',
      entityId: 'ticket-uuid-2',
      action: 'status_changed',
      actorId: 'agent-1',
      previousValues: { status: 'OPEN' },
      newValues: { status: 'IN_PROGRESS' },
    });

    const rows = db.prepare(
      'SELECT * FROM audit_entries WHERE entity_id = ? ORDER BY occurred_at ASC'
    ).all('ticket-uuid-2');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].action, 'created');
    assert.equal(rows[1].action, 'status_changed');
  });

  it('rejects UPDATE on audit entries (immutability trigger)', () => {
    audit(db, {
      entityType: 'Ticket',
      entityId: 'ticket-uuid-3',
      action: 'created',
      actorId: 'user-1',
    });
    const row = db.prepare('SELECT id FROM audit_entries WHERE entity_id = ?').get('ticket-uuid-3');
    assert.throws(
      () => db.prepare('UPDATE audit_entries SET action = ? WHERE id = ?').run('tampered', row.id),
      /immutable/
    );
  });

  it('rejects DELETE on audit entries (append-only trigger)', () => {
    audit(db, {
      entityType: 'Ticket',
      entityId: 'ticket-uuid-4',
      action: 'created',
      actorId: 'user-1',
    });
    const row = db.prepare('SELECT id FROM audit_entries WHERE entity_id = ?').get('ticket-uuid-4');
    assert.throws(
      () => db.prepare('DELETE FROM audit_entries WHERE id = ?').run(row.id),
      /append-only/
    );
  });

  it('does not throw when audit write fails (soft-fail, ADR-001)', () => {
    // Drop the table to force the INSERT to fail
    const badDb = new DatabaseSync(':memory:');
    // No audit_entries table — INSERT will throw internally
    assert.doesNotThrow(() => {
      audit(badDb, {
        entityType: 'Ticket',
        entityId: 'ticket-x',
        action: 'created',
        actorId: 'user-1',
      });
    });
    badDb.close();
  });
});
