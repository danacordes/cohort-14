import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { addComment, getComments } from './ticketCommentService.js';

function buildDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE ticket_status (id TEXT PRIMARY KEY, code TEXT NOT NULL);
    INSERT INTO ticket_status VALUES ('s1','OPEN'), ('s2','CLOSED'), ('s3','IN_PROGRESS');

    CREATE TABLE ticket (
      id TEXT PRIMARY KEY,
      status_id TEXT NOT NULL,
      title TEXT,
      FOREIGN KEY (status_id) REFERENCES ticket_status(id)
    );
    INSERT INTO ticket VALUES ('t1', 's1', 'Open ticket');
    INSERT INTO ticket VALUES ('t2', 's2', 'Closed ticket');

    CREATE TABLE ticket_comment (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      body TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
      author_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE
    );
    CREATE TRIGGER ticket_comment_no_update
    BEFORE UPDATE ON ticket_comment
    BEGIN
      SELECT RAISE(ABORT, 'ticket_comment rows are immutable');
    END;
    CREATE TRIGGER ticket_comment_no_delete
    BEFORE DELETE ON ticket_comment
    BEGIN
      SELECT RAISE(ABORT, 'ticket_comment rows are append-only');
    END;
  `);
  return db;
}

describe('ticketCommentService', () => {
  let db;
  before(() => { db = buildDb(); });
  after(() => { db.close(); });

  it('adds a public comment', () => {
    const row = addComment(db, {
      ticketId: 't1', authorId: 'u1', body: 'Hello', isInternal: false, authorRole: 'user',
    });
    assert.equal(row.body, 'Hello');
    assert.equal(row.is_internal, 0);
  });

  it('adds an internal note for agent', () => {
    const row = addComment(db, {
      ticketId: 't1', authorId: 'a1', body: 'Note', isInternal: true, authorRole: 'agent',
    });
    assert.equal(row.is_internal, 1);
  });

  it('rejects internal note from user role', () => {
    assert.throws(
      () => addComment(db, { ticketId: 't1', authorId: 'u2', body: 'note', isInternal: true, authorRole: 'user' }),
      { name: 'ForbiddenError' }
    );
  });

  it('rejects empty body', () => {
    assert.throws(
      () => addComment(db, { ticketId: 't1', authorId: 'u1', body: '  ', isInternal: false, authorRole: 'user' }),
      { name: 'ValidationError' }
    );
  });

  it('rejects internal note on closed ticket', () => {
    assert.throws(
      () => addComment(db, { ticketId: 't2', authorId: 'a1', body: 'note', isInternal: true, authorRole: 'agent' }),
      { name: 'ValidationError' }
    );
  });

  it('getComments hides internal notes from user role', () => {
    const all = getComments(db, 't1', 'agent');
    const userView = getComments(db, 't1', 'user');
    const hasInternal = all.some((c) => c.is_internal === 1);
    assert.ok(hasInternal);
    assert.ok(userView.every((c) => c.is_internal === 0));
  });

  it('db trigger prevents deleting comments', () => {
    const row = addComment(db, { ticketId: 't1', authorId: 'u1', body: 'will stay', isInternal: false, authorRole: 'user' });
    assert.throws(
      () => db.prepare('DELETE FROM ticket_comment WHERE id = ?').run(row.id),
      /append-only/
    );
  });
});
