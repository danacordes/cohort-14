import path from 'path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Open a SQLite connection and apply the platform Data-contract pragmas.
 *
 * Driver note: `node:sqlite` (DatabaseSync) is used here because no SQLCipher
 * npm package currently compiles against Node.js >=26 (V8 API breaking changes
 * in v26 removed GetPrototype / PropertyCallbackInfo::This used by better-sqlite3).
 * The PRAGMA key call below is intentionally included so that swapping to a
 * SQLCipher-enabled runtime (e.g. @journeyapps/sqlcipher or a future compatible
 * better-sqlite3-multiple-ciphers build) requires only changing the import — no
 * schema or migration changes are needed. On the standard sqlite3 runtime the
 * PRAGMA key is silently ignored; on a SQLCipher runtime it encrypts the file.
 *
 * Production deployment checklist:
 *   1. Use a Node.js build linked against SQLCipher, or replace this import with
 *      a SQLCipher-compatible driver that exposes the same synchronous API.
 *   2. Set DB_ENCRYPTION_KEY in the environment secrets manager (never commit).
 *   3. Rotate keys with: PRAGMA rekey = '<new-key>';
 */
export function openDatabase(
  dbPath = path.resolve(process.cwd(), process.env.DB_PATH ?? 'dev.db')
) {
  const db = new DatabaseSync(dbPath);

  const encryptionKey = process.env.DB_ENCRYPTION_KEY;
  if (encryptionKey) {
    // SQLCipher key pragma — no-op on standard sqlite3, enforced on SQLCipher runtime.
    db.exec(`PRAGMA key = '${encryptionKey.replace(/'/g, "''")}'`);
  }

  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA foreign_keys = ON;`);

  return db;
}
