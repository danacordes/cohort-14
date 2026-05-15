import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getWorkloadSummary } from './agentWorkloadService.js';

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE ticket_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );

    INSERT INTO ticket_status (code, label) VALUES
      ('OPEN', 'Open'),
      ('IN_PROGRESS', 'In Progress'),
      ('PENDING_USER_RESPONSE', 'Pending User Response'),
      ('RESOLVED', 'Resolved'),
      ('CLOSED', 'Closed');

    CREATE TABLE ticket (
      id TEXT PRIMARY KEY,
      assigned_to TEXT,
      status_id INTEGER NOT NULL REFERENCES ticket_status(id)
    );
  `);
  return db;
}

function insertUser(db, { id, email, role = 'agent' }) {
  db.prepare('INSERT INTO users (id, email, role) VALUES (?, ?, ?)').run(id, email, role);
}

function insertTicket(db, { id, assignedTo, statusCode }) {
  const statusId = db.prepare('SELECT id FROM ticket_status WHERE code = ?').get(statusCode).id;
  db.prepare('INSERT INTO ticket (id, assigned_to, status_id) VALUES (?, ?, ?)').run(id, assignedTo ?? null, statusId);
}

describe('getWorkloadSummary', () => {
  let db;

  before(() => {
    db = createTestDb();
    insertUser(db, { id: 'agent-1', email: 'alice@example.com' });
    insertUser(db, { id: 'agent-2', email: 'bob@example.com' });
    insertUser(db, { id: 'admin-1', email: 'admin@example.com', role: 'admin' });
  });

  after(() => { db.close(); });

  it('returns all agents (including those with zero open tickets)', () => {
    const summary = getWorkloadSummary(db);
    assert.equal(summary.length, 2);
    assert.ok(summary.every((s) => ['alice@example.com', 'bob@example.com'].includes(s.agentName)));
  });

  it('counts open tickets correctly per agent', () => {
    insertTicket(db, { id: 't1', assignedTo: 'agent-1', statusCode: 'OPEN' });
    insertTicket(db, { id: 't2', assignedTo: 'agent-1', statusCode: 'IN_PROGRESS' });
    insertTicket(db, { id: 't3', assignedTo: 'agent-2', statusCode: 'OPEN' });

    const summary = getWorkloadSummary(db);
    const alice = summary.find((s) => s.agentId === 'agent-1');
    const bob = summary.find((s) => s.agentId === 'agent-2');

    assert.equal(alice.openTicketCount, 2);
    assert.equal(bob.openTicketCount, 1);
  });

  it('does not count RESOLVED tickets', () => {
    insertTicket(db, { id: 't4', assignedTo: 'agent-2', statusCode: 'RESOLVED' });

    const summary = getWorkloadSummary(db);
    const bob = summary.find((s) => s.agentId === 'agent-2');
    assert.equal(bob.openTicketCount, 1);
  });

  it('does not count CLOSED tickets', () => {
    insertTicket(db, { id: 't5', assignedTo: 'agent-2', statusCode: 'CLOSED' });

    const summary = getWorkloadSummary(db);
    const bob = summary.find((s) => s.agentId === 'agent-2');
    assert.equal(bob.openTicketCount, 1);
  });

  it('does not include non-agent users in the summary', () => {
    const summary = getWorkloadSummary(db);
    assert.ok(!summary.find((s) => s.agentId === 'admin-1'));
  });

  it('sorts by openTicketCount descending', () => {
    const summary = getWorkloadSummary(db);
    for (let i = 0; i < summary.length - 1; i++) {
      assert.ok(summary[i].openTicketCount >= summary[i + 1].openTicketCount);
    }
  });
});
