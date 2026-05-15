import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { runPendingMigrations } from './migrate-lib.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function openMemoryDb() {
  return new DatabaseSync(':memory:');
}

/** Write a temporary migrations directory with the given SQL files. */
function makeTmpMigrationsDir(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-test-'));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql, 'utf8');
  }
  return dir;
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Override the migrations directory used by migrate-lib.
 * We do this by temporarily patching the module-level constant via a secondary
 * export — but since migrate-lib doesn't expose MIGRATIONS_DIR, we test via a
 * fresh in-memory DB and real SQL migration files in a temp directory.
 *
 * Because Node's built-in module cache is immutable for ES modules, we test the
 * exported function directly against real migration files found in the project.
 */

// ── tests ────────────────────────────────────────────────────────────────────

describe('runPendingMigrations (against real project migrations)', () => {
  let db;

  before(() => {
    db = openMemoryDb();
  });

  after(() => {
    db.close();
  });

  it('creates the schema_migrations table on first run', () => {
    runPendingMigrations(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .all();
    assert.equal(tables.length, 1);
  });

  it('records all migration filenames in schema_migrations', () => {
    const applied = db
      .prepare('SELECT filename FROM schema_migrations ORDER BY filename')
      .all()
      .map((r) => r.filename);
    assert.ok(applied.length > 0, 'Expected at least one migration to be applied');
    assert.ok(applied.every((f) => f.endsWith('.sql')), 'All entries should end in .sql');
  });

  it('is idempotent — running again does not throw or duplicate entries', () => {
    const before = db
      .prepare('SELECT COUNT(*) as c FROM schema_migrations')
      .get().c;
    runPendingMigrations(db);
    const after = db
      .prepare('SELECT COUNT(*) as c FROM schema_migrations')
      .get().c;
    assert.equal(before, after);
  });

  it('creates the ticket_status table (migration 001)', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_status'")
      .all();
    assert.equal(tables.length, 1);
  });

  it('creates the users table (migration 002)', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all();
    assert.equal(tables.length, 1);
  });
});

describe('runPendingMigrations — skips already-applied files', () => {
  it('applies only new migrations when some are already recorded', () => {
    const db2 = openMemoryDb();
    // First full run
    runPendingMigrations(db2);
    const firstCount = db2.prepare('SELECT COUNT(*) as c FROM schema_migrations').get().c;

    // Second run should apply nothing new
    runPendingMigrations(db2);
    const secondCount = db2.prepare('SELECT COUNT(*) as c FROM schema_migrations').get().c;

    assert.equal(firstCount, secondCount);
    db2.close();
  });
});
