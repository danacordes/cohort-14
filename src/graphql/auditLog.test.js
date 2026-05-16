import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ForbiddenError } from '../errors/index.js';
import { SYSTEM_AI_USER_ID } from '../constants/systemUsers.js';

/**
 * Inline the auditLog resolver logic for unit testing without spinning up
 * a full Apollo server.  We import the resolver indirectly by re-implementing
 * the same query against a real in-memory SQLite DB with the same SQL.
 */

const AUDIT_ENTRY_SELECT = `
  SELECT ae.*,
    u.email AS actor_name
  FROM audit_entries ae
  LEFT JOIN users u ON u.id = ae.actor_id
`;

function requireRole(user, ...roles) {
  if (!user) throw new ForbiddenError('Authentication required');
  if (!roles.includes(user.role)) throw new ForbiddenError('Insufficient role');
}

function auditLog(db, { entityType, entityId, page = {} }, user) {
  requireRole(user, 'agent', 'admin');
  const pageNum  = Math.max(1, page.page     ?? 1);
  const pageSize = Math.min(100, Math.max(1, page.pageSize ?? 25));
  const offset   = (pageNum - 1) * pageSize;

  const totalCount = db.prepare(
    `SELECT COUNT(*) AS cnt FROM audit_entries WHERE entity_type = ? AND entity_id = ?`
  ).get(entityType, entityId).cnt;

  const rows = db.prepare(
    `${AUDIT_ENTRY_SELECT}
     WHERE ae.entity_type = ? AND ae.entity_id = ?
     ORDER BY ae.occurred_at DESC
     LIMIT ? OFFSET ?`
  ).all(entityType, entityId, pageSize, offset);

  return { items: rows, totalCount, page: pageNum, pageSize };
}

function buildDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user'
    );

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
  `);

  db.prepare(`INSERT INTO users VALUES ('u1', 'agent@example.com', 'agent')`).run();
  db.prepare(`INSERT INTO users VALUES ('u2', 'admin@example.com', 'admin')`).run();
  db.prepare(
    `INSERT INTO users VALUES (?, 'ai-system@platform.internal', 'user')`
  ).run(SYSTEM_AI_USER_ID);

  // Insert 30 audit entries for entity 'Ticket' / 'ticket-1'
  for (let i = 1; i <= 30; i++) {
    db.prepare(
      `INSERT INTO audit_entries (id, entity_type, entity_id, action, actor_id, occurred_at)
       VALUES (?, 'Ticket', 'ticket-1', ?, 'u1', datetime('now', '+${i} seconds'))`
    ).run(`entry-${i}`, `action_${i}`);
  }

  // Insert 2 entries for a different entity
  db.prepare(
    `INSERT INTO audit_entries (id, entity_type, entity_id, action, actor_id)
     VALUES ('other-1', 'KBArticle', 'article-1', 'created', 'u2')`
  ).run();

  // Insert 1 AI-attributed entry (uses platform AI user id + actor_kind)
  db.prepare(
    `INSERT INTO audit_entries (id, entity_type, entity_id, action, actor_id, actor_kind, ai_confidence, ai_feature)
     VALUES ('sys-1', 'Ticket', 'ticket-2', 'category_suggested', ?, 'ai_system', 0.85, 'classification')`
  ).run(SYSTEM_AI_USER_ID);

  return db;
}

describe('auditLog resolver', () => {
  let db;
  before(() => { db = buildDb(); });
  after(() => { db.close(); });

  it('returns entries for the correct entity only', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, { role: 'agent' });
    assert.equal(result.totalCount, 30);
    assert.ok(result.items.every((r) => r.entity_type === 'Ticket' && r.entity_id === 'ticket-1'));
  });

  it('returns entries sorted by occurred_at DESC', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, { role: 'agent' });
    for (let i = 0; i < result.items.length - 1; i++) {
      assert.ok(result.items[i].occurred_at >= result.items[i + 1].occurred_at);
    }
  });

  it('defaults to page 1 with pageSize 25', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, { role: 'admin' });
    assert.equal(result.items.length, 25);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 25);
    assert.equal(result.totalCount, 30);
  });

  it('returns remaining items on page 2', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1', page: { page: 2, pageSize: 25 } }, { role: 'agent' });
    assert.equal(result.items.length, 5);
    assert.equal(result.page, 2);
  });

  it('respects custom pageSize', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1', page: { page: 1, pageSize: 10 } }, { role: 'admin' });
    assert.equal(result.items.length, 10);
    assert.equal(result.pageSize, 10);
  });

  it('caps pageSize at 100', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1', page: { page: 1, pageSize: 999 } }, { role: 'admin' });
    assert.equal(result.pageSize, 100);
  });

  it('returns empty items for an entity with no entries', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'nonexistent' }, { role: 'agent' });
    assert.equal(result.totalCount, 0);
    assert.equal(result.items.length, 0);
  });

  it('includes actorName from users JOIN', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1', page: { pageSize: 1 } }, { role: 'agent' });
    assert.equal(result.items[0].actor_name, 'agent@example.com');
  });

  it('exposes actor_kind and AI metadata for AI-attributed rows', () => {
    const result = auditLog(db, { entityType: 'Ticket', entityId: 'ticket-2' }, { role: 'admin' });
    assert.equal(result.totalCount, 1);
    assert.equal(result.items[0].actor_kind, 'ai_system');
    assert.equal(result.items[0].ai_confidence, 0.85);
    assert.equal(result.items[0].ai_feature, 'classification');
    assert.equal(result.items[0].actor_name, 'ai-system@platform.internal');
  });

  it('denies user role', () => {
    assert.throws(
      () => auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, { role: 'user' }),
      { name: 'ForbiddenError' }
    );
  });

  it('denies unauthenticated caller', () => {
    assert.throws(
      () => auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, null),
      { name: 'ForbiddenError' }
    );
  });

  it('allows agent role', () => {
    assert.doesNotThrow(
      () => auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, { role: 'agent' })
    );
  });

  it('allows admin role', () => {
    assert.doesNotThrow(
      () => auditLog(db, { entityType: 'Ticket', entityId: 'ticket-1' }, { role: 'admin' })
    );
  });

  it('KBArticle entity type is supported', () => {
    const result = auditLog(db, { entityType: 'KBArticle', entityId: 'article-1' }, { role: 'admin' });
    assert.equal(result.totalCount, 1);
    assert.equal(result.items[0].action, 'created');
    assert.equal(result.items[0].actor_name, 'admin@example.com');
  });
});
