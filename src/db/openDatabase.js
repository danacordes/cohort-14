import path from 'path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Open SQLite with platform Data-contract pragmas (WAL, foreign_keys).
 * Uses experimental built-in SQLite (matches Node 22+); production SQLCipher swaps the driver layer,
 * keeping the same schema and migration files.
 *
 * Identity: ticket.submitter_ref + audit_entries.actor_id are opaque TEXT until users table exists.
 * Reserve public numbers inside a BEGIN IMMEDIATE ... COMMIT with the ticket INSERT (see ticket-number.js).
 */
export function openDatabase(
  dbPath = path.resolve(process.cwd(), process.env.DB_PATH ?? 'dev.db')
) {
  const db = new DatabaseSync(dbPath, {
    enableForeignKeyConstraints: true,
  });
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA foreign_keys = ON;`);
  return db;
}
