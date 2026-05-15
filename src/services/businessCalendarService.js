import { randomUUID } from 'crypto';
import { ValidationError, NotFoundError } from '../errors/index.js';

// ─── Config ──────────────────────────────────────────────────────────────────

export function getConfig(db) {
  return db.prepare('SELECT auto_close_business_days, csat_enabled FROM closure_config WHERE id = 1').get();
}

export function updateConfig(db, { autoCloseBusinessDays }) {
  if (!Number.isInteger(autoCloseBusinessDays) || autoCloseBusinessDays < 1) {
    throw new ValidationError('autoCloseBusinessDays must be an integer ≥ 1');
  }
  db.prepare(
    `UPDATE closure_config SET auto_close_business_days = ? WHERE id = 1`
  ).run(autoCloseBusinessDays);
  return getConfig(db);
}

export function updateCSATEnabled(db, enabled) {
  db.prepare(`UPDATE closure_config SET csat_enabled = ? WHERE id = 1`).run(enabled ? 1 : 0);
  return getConfig(db);
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

export function listHolidays(db) {
  return db.prepare('SELECT * FROM holiday ORDER BY date ASC').all();
}

export function addHoliday(db, { date, label, createdBy }) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Holiday date must be in YYYY-MM-DD format');
  }
  if (!label || !label.trim()) throw new ValidationError('Holiday label is required');
  const existing = db.prepare('SELECT id FROM holiday WHERE date = ?').get(date);
  if (existing) throw new ValidationError(`A holiday on ${date} already exists`);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO holiday (id, date, label, created_by, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, date, label.trim(), createdBy);
  return db.prepare('SELECT * FROM holiday WHERE id = ?').get(id);
}

export function removeHoliday(db, id) {
  const existing = db.prepare('SELECT id FROM holiday WHERE id = ?').get(id);
  if (!existing) throw new NotFoundError(`Holiday ${id} not found`);
  db.prepare('DELETE FROM holiday WHERE id = ?').run(id);
  return true;
}

// ─── Business-day arithmetic ──────────────────────────────────────────────────

/**
 * Add `days` business days (Mon–Fri, excluding `holidayDates`) to `startDate`.
 *
 * @param {Date}     startDate
 * @param {number}   days          positive integer
 * @param {string[]} holidayDates  ISO date strings to exclude, e.g. ['2026-12-25']
 * @returns {Date}
 */
export function addBusinessDays(startDate, days, holidayDates = []) {
  const holidaySet = new Set(holidayDates);
  let current = new Date(startDate);
  let added = 0;

  while (added < days) {
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    const dow = current.getUTCDay(); // 0=Sun, 6=Sat
    const isoDate = current.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(isoDate)) {
      added++;
    }
  }
  return current;
}

/**
 * Compute the auto_close_at timestamp for a resolved ticket.
 *
 * @param {object} db
 * @param {string} resolvedAt  ISO datetime string
 * @returns {string}  ISO datetime string
 */
export function computeAutoCloseAt(db, resolvedAt) {
  const config = getConfig(db);
  const days = config?.auto_close_business_days ?? 5;
  const holidays = listHolidays(db).map((h) => h.date);
  return addBusinessDays(new Date(resolvedAt), days, holidays).toISOString();
}
