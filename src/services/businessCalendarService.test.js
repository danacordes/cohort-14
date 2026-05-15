import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  getConfig,
  updateConfig,
  updateCSATEnabled,
  listHolidays,
  addHoliday,
  removeHoliday,
  addBusinessDays,
  computeAutoCloseAt,
} from './businessCalendarService.js';

function buildDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE closure_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_close_business_days INTEGER NOT NULL DEFAULT 5,
      csat_enabled INTEGER NOT NULL DEFAULT 1 CHECK (csat_enabled IN (0, 1))
    );
    INSERT INTO closure_config VALUES (1, 5, 1);

    CREATE TABLE holiday (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('businessCalendarService', () => {
  let db;
  before(() => { db = buildDb(); });
  after(() => { db.close(); });

  it('getConfig returns defaults', () => {
    const c = getConfig(db);
    assert.equal(c.auto_close_business_days, 5);
    assert.equal(c.csat_enabled, 1);
  });

  it('updateConfig persists new value', () => {
    updateConfig(db, { autoCloseBusinessDays: 3 });
    assert.equal(getConfig(db).auto_close_business_days, 3);
    updateConfig(db, { autoCloseBusinessDays: 5 }); // restore
  });

  it('updateConfig rejects invalid value', () => {
    assert.throws(() => updateConfig(db, { autoCloseBusinessDays: 0 }), { name: 'ValidationError' });
    assert.throws(() => updateConfig(db, { autoCloseBusinessDays: 1.5 }), { name: 'ValidationError' });
  });

  it('updateCSATEnabled toggles the flag', () => {
    updateCSATEnabled(db, false);
    assert.equal(getConfig(db).csat_enabled, 0);
    updateCSATEnabled(db, true);
    assert.equal(getConfig(db).csat_enabled, 1);
  });

  it('addHoliday creates holiday record', () => {
    const h = addHoliday(db, { date: '2026-12-25', label: 'Christmas', createdBy: 'admin' });
    assert.equal(h.date, '2026-12-25');
    assert.equal(h.label, 'Christmas');
  });

  it('addHoliday rejects duplicate date', () => {
    assert.throws(() => addHoliday(db, { date: '2026-12-25', label: 'Dup', createdBy: 'admin' }), { name: 'ValidationError' });
  });

  it('addHoliday rejects invalid date format', () => {
    assert.throws(() => addHoliday(db, { date: '25/12/2026', label: 'X', createdBy: 'admin' }), { name: 'ValidationError' });
  });

  it('listHolidays returns created holidays', () => {
    const list = listHolidays(db);
    assert.ok(list.length >= 1);
    assert.ok(list.some((h) => h.date === '2026-12-25'));
  });

  it('removeHoliday removes the holiday', () => {
    const h = addHoliday(db, { date: '2026-07-04', label: 'Independence', createdBy: 'admin' });
    removeHoliday(db, h.id);
    assert.ok(!listHolidays(db).find((x) => x.id === h.id));
  });

  it('removeHoliday throws for unknown id', () => {
    assert.throws(() => removeHoliday(db, 'nonexistent'), { name: 'NotFoundError' });
  });

  describe('addBusinessDays', () => {
    it('skips weekends', () => {
      // 2026-05-15 is a Friday; +1 business day => 2026-05-18 (Monday)
      const start = new Date('2026-05-15T00:00:00Z');
      const result = addBusinessDays(start, 1, []);
      assert.equal(result.toISOString().slice(0, 10), '2026-05-18');
    });

    it('skips holidays', () => {
      // Monday -> skip Mon (holiday) -> Tue
      const start = new Date('2026-05-15T00:00:00Z'); // Friday
      const result = addBusinessDays(start, 1, ['2026-05-18']); // skip Monday
      assert.equal(result.toISOString().slice(0, 10), '2026-05-19');
    });

    it('adds 5 business days from a Monday', () => {
      const start = new Date('2026-05-18T00:00:00Z'); // Monday
      const result = addBusinessDays(start, 5, []);
      assert.equal(result.toISOString().slice(0, 10), '2026-05-25'); // next Monday
    });
  });

  it('computeAutoCloseAt uses config business days', () => {
    const resolvedAt = '2026-05-18T12:00:00Z'; // Monday
    const result = computeAutoCloseAt(db, resolvedAt);
    assert.ok(typeof result === 'string');
    assert.ok(result > resolvedAt);
  });
});
