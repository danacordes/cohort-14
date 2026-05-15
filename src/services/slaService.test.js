import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  computeDueDates,
  recalculateDueDates,
  getSLAStatus,
  stampRespondedAt,
  checkAndStampBreaches,
} from './slaService.js';

function buildTicketDb({ slaResponseDueAt = null, slaResolutionDueAt = null, slaPausedAt = null, slaRespondedAt = null } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE ticket (
      id TEXT PRIMARY KEY,
      sla_response_due_at TEXT,
      sla_resolution_due_at TEXT,
      sla_paused_at TEXT,
      sla_responded_at TEXT,
      sla_response_breached_at TEXT,
      sla_resolution_breached_at TEXT,
      updated_at TEXT
    );
  `);
  db.prepare(`INSERT INTO ticket VALUES ('t1', ?, ?, ?, ?, NULL, NULL, datetime('now'))`)
    .run(slaResponseDueAt, slaResolutionDueAt, slaPausedAt, slaRespondedAt);
  return db;
}

describe('computeDueDates', () => {
  it('returns ISO datetime strings', () => {
    const { responseDue, resolutionDue } = computeDueDates('HIGH');
    assert.match(responseDue, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(resolutionDue, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses supplied policy when provided', () => {
    const now = new Date();
    const policy = { responseTimeHours: 2, resolutionTimeHours: 6 };
    const { responseDue, resolutionDue } = computeDueDates('HIGH', now, policy);
    const responseMs = new Date(responseDue) - now;
    const resolutionMs = new Date(resolutionDue) - now;
    assert.ok(Math.abs(responseMs - 2 * 3600 * 1000) < 1000);
    assert.ok(Math.abs(resolutionMs - 6 * 3600 * 1000) < 1000);
  });

  it('response due is before resolution due', () => {
    const { responseDue, resolutionDue } = computeDueDates('HIGH');
    assert.ok(new Date(responseDue) < new Date(resolutionDue));
  });

  it('CRITICAL due times are shorter than LOW', () => {
    const now = new Date();
    const critical = computeDueDates('CRITICAL', now);
    const low = computeDueDates('LOW', now);
    assert.ok(new Date(critical.resolutionDue) < new Date(low.resolutionDue));
  });

  it('falls back to MEDIUM defaults for unknown priority code', () => {
    const medium = computeDueDates('MEDIUM');
    const unknown = computeDueDates('NONEXISTENT');
    const mediumRes = new Date(medium.resolutionDue).getTime();
    const unknownRes = new Date(unknown.resolutionDue).getTime();
    assert.ok(Math.abs(mediumRes - unknownRes) < 2000);
  });
});

describe('recalculateDueDates', () => {
  it('resets clock from now with default policy', () => {
    const now = new Date();
    const { responseDue, resolutionDue } = recalculateDueDates('HIGH', now);
    assert.ok(new Date(responseDue) > now);
    assert.ok(new Date(resolutionDue) > new Date(responseDue));
  });

  it('uses supplied policy', () => {
    const now = new Date();
    const policy = { responseTimeHours: 1, resolutionTimeHours: 3 };
    const { responseDue } = recalculateDueDates('HIGH', now, policy);
    const ms = new Date(responseDue) - now;
    assert.ok(Math.abs(ms - 3600 * 1000) < 1000);
  });
});

describe('stampRespondedAt', () => {
  it('stamps sla_responded_at on first IN_PROGRESS transition', () => {
    const db = buildTicketDb();
    const now = new Date();
    stampRespondedAt(db, 't1', now);
    const row = db.prepare('SELECT sla_responded_at FROM ticket WHERE id = ?').get('t1');
    assert.ok(row.sla_responded_at);
  });

  it('does not overwrite an existing sla_responded_at', () => {
    const earlier = new Date(Date.now() - 60000).toISOString();
    const db = buildTicketDb({ slaRespondedAt: earlier });
    stampRespondedAt(db, 't1', new Date());
    const row = db.prepare('SELECT sla_responded_at FROM ticket WHERE id = ?').get('t1');
    assert.equal(row.sla_responded_at, earlier);
  });
});

describe('checkAndStampBreaches', () => {
  it('stamps sla_response_breached_at when response clock exceeded', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const db = buildTicketDb({ slaResponseDueAt: past, slaResolutionDueAt: new Date(Date.now() + 3600000).toISOString() });
    checkAndStampBreaches(db, 't1');
    const row = db.prepare('SELECT sla_response_breached_at FROM ticket WHERE id = ?').get('t1');
    assert.ok(row.sla_response_breached_at);
  });

  it('stamps sla_resolution_breached_at when resolution clock exceeded', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const db = buildTicketDb({
      slaResponseDueAt: new Date(Date.now() - 2000).toISOString(),
      slaResolutionDueAt: past,
      slaRespondedAt: new Date(Date.now() - 500).toISOString(),
    });
    checkAndStampBreaches(db, 't1');
    const row = db.prepare('SELECT sla_resolution_breached_at FROM ticket WHERE id = ?').get('t1');
    assert.ok(row.sla_resolution_breached_at);
  });

  it('does not stamp breaches when clock is paused', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const db = buildTicketDb({ slaResponseDueAt: past, slaPausedAt: new Date().toISOString() });
    checkAndStampBreaches(db, 't1');
    const row = db.prepare('SELECT sla_response_breached_at FROM ticket WHERE id = ?').get('t1');
    assert.equal(row.sla_response_breached_at, null);
  });

  it('does not overwrite an already-stamped breach', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const db = buildTicketDb({ slaResponseDueAt: past });
    checkAndStampBreaches(db, 't1');
    const first = db.prepare('SELECT sla_response_breached_at FROM ticket WHERE id = ?').get('t1').sla_response_breached_at;
    checkAndStampBreaches(db, 't1');
    const second = db.prepare('SELECT sla_response_breached_at FROM ticket WHERE id = ?').get('t1').sla_response_breached_at;
    assert.equal(first, second);
  });
});

describe('getSLAStatus', () => {
  it('returns UNKNOWN when no resolution due date', () => {
    const status = getSLAStatus({ sla_resolution_due_at: null, sla_paused_at: null });
    assert.equal(status, 'UNKNOWN');
  });

  it('returns PAUSED when sla_paused_at is set', () => {
    const status = getSLAStatus({
      sla_resolution_due_at: new Date(Date.now() + 3600000).toISOString(),
      sla_paused_at: new Date().toISOString(),
    });
    assert.equal(status, 'PAUSED');
  });

  it('returns BREACHED when due time is in the past', () => {
    const status = getSLAStatus({
      sla_resolution_due_at: new Date(Date.now() - 1000).toISOString(),
      sla_paused_at: null,
    });
    assert.equal(status, 'BREACHED');
  });

  it('returns ON_TRACK when plenty of time remains', () => {
    const status = getSLAStatus({
      sla_resolution_due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      sla_paused_at: null,
      _priorityCode: 'LOW',
    });
    assert.ok(['ON_TRACK', 'AT_RISK'].includes(status));
  });
});
