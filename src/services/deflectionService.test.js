import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { recordDeflection, listDeflectionEvents } from './deflectionService.js';

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE deflection_event (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      article_id TEXT NOT NULL,
      query_text TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('recordDeflection', () => {
  let db;

  before(() => { db = createTestDb(); });
  after(() => { db.close(); });

  it('inserts a deflection event and returns it', () => {
    const event = recordDeflection(db, {
      userId: 'user-1',
      articleId: 'article-abc',
      queryText: 'my printer is offline',
    });
    assert.ok(event);
    assert.equal(event.user_id, 'user-1');
    assert.equal(event.article_id, 'article-abc');
    assert.equal(event.query_text, 'my printer is offline');
    assert.match(event.id, /^[0-9a-f-]{36}$/);
  });

  it('defaults queryText to empty string when omitted', () => {
    const event = recordDeflection(db, { userId: 'user-2', articleId: 'article-xyz' });
    assert.equal(event.query_text, '');
  });

  it('throws ValidationError when userId is missing', () => {
    assert.throws(
      () => recordDeflection(db, { articleId: 'article-1' }),
      { name: 'ValidationError' }
    );
  });

  it('throws ValidationError when articleId is missing', () => {
    assert.throws(
      () => recordDeflection(db, { userId: 'user-1' }),
      { name: 'ValidationError' }
    );
  });
});

describe('listDeflectionEvents', () => {
  let db;

  before(() => {
    db = createTestDb();
    recordDeflection(db, { userId: 'user-A', articleId: 'art-1', queryText: 'q1' });
    recordDeflection(db, { userId: 'user-A', articleId: 'art-2', queryText: 'q2' });
    recordDeflection(db, { userId: 'user-B', articleId: 'art-1', queryText: 'q3' });
  });
  after(() => { db.close(); });

  it('returns all events when no filter', () => {
    const events = listDeflectionEvents(db);
    assert.equal(events.length, 3);
  });

  it('filters by userId', () => {
    const events = listDeflectionEvents(db, { userId: 'user-A' });
    assert.equal(events.length, 2);
    assert.ok(events.every((e) => e.user_id === 'user-A'));
  });
});
