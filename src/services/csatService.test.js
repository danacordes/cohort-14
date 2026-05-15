import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { generateSurveyToken, validateSurveyToken, recordResponse, isEnabled } from './csatService.js';

process.env.CSAT_SECRET = 'test-csat-secret-32chars-xxxxxxxxxxx';

function buildDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE closure_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_close_business_days INTEGER NOT NULL DEFAULT 5,
      csat_enabled INTEGER NOT NULL DEFAULT 1 CHECK (csat_enabled IN (0, 1))
    );
    INSERT INTO closure_config VALUES (1, 5, 1);

    CREATE TABLE csat_response (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      closure_number INTEGER NOT NULL DEFAULT 1,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ticket_id, closure_number)
    );
  `);
  return db;
}

describe('csatService', () => {
  let db;
  before(() => { db = buildDb(); });
  after(() => { db.close(); });

  it('generateSurveyToken returns a string', () => {
    const token = generateSurveyToken('ticket-1', 1);
    assert.equal(typeof token, 'string');
    assert.ok(token.split('.').length === 3); // JWT format
  });

  it('validateSurveyToken round-trips correctly', () => {
    const token = generateSurveyToken('ticket-1', 2);
    const payload = validateSurveyToken(token);
    assert.equal(payload.ticketId, 'ticket-1');
    assert.equal(payload.closureNumber, 2);
  });

  it('validateSurveyToken rejects tampered token', () => {
    const token = generateSurveyToken('ticket-1', 1);
    const tampered = token.slice(0, -3) + 'xxx';
    assert.throws(() => validateSurveyToken(tampered), { name: 'ValidationError' });
  });

  it('validateSurveyToken rejects missing token', () => {
    assert.throws(() => validateSurveyToken(null), { name: 'ValidationError' });
  });

  it('recordResponse inserts correctly', () => {
    const row = recordResponse(db, { ticketId: 't1', closureNumber: 1, rating: 4, comment: 'Good' });
    assert.equal(row.rating, 4);
    assert.equal(row.ticket_id, 't1');
    assert.equal(row.comment, 'Good');
  });

  it('recordResponse rejects invalid rating', () => {
    assert.throws(() => recordResponse(db, { ticketId: 't1', closureNumber: 99, rating: 6 }), { name: 'ValidationError' });
    assert.throws(() => recordResponse(db, { ticketId: 't1', closureNumber: 99, rating: 0 }), { name: 'ValidationError' });
  });

  it('recordResponse rejects duplicate submission', () => {
    // t1 / closure 1 already submitted above
    assert.throws(
      () => recordResponse(db, { ticketId: 't1', closureNumber: 1, rating: 3 }),
      { name: 'ValidationError' }
    );
  });

  it('isEnabled returns true by default', () => {
    assert.equal(isEnabled(db), true);
  });

  it('isEnabled returns false when disabled', () => {
    db.prepare('UPDATE closure_config SET csat_enabled = 0 WHERE id = 1').run();
    assert.equal(isEnabled(db), false);
    db.prepare('UPDATE closure_config SET csat_enabled = 1 WHERE id = 1').run();
  });
});
