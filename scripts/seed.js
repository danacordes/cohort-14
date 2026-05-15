import 'dotenv/config';
import path from 'path';
import { openDatabase } from '../src/db/openDatabase.js';
import { runPendingMigrations } from '../src/db/migrate-lib.js';

const raw = process.env.DB_PATH ?? 'dev.db';
const dbPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);

const db = openDatabase(dbPath);

try {
  runPendingMigrations(db);

  // Ticket categories — seeded with INSERT OR IGNORE so the script is re-runnable.
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO ticket_category (id, name, slug)
    VALUES (?, ?, ?)
  `);

  const categories = [
    { id: 'cat-hardware',         name: 'Hardware',              slug: 'hardware' },
    { id: 'cat-software',         name: 'Software',              slug: 'software' },
    { id: 'cat-network',          name: 'Network & Connectivity', slug: 'network' },
    { id: 'cat-access-identity',  name: 'Access & Identity',     slug: 'access-identity' },
    { id: 'cat-general',          name: 'General',               slug: 'general' },
  ];

  db.exec('BEGIN');
  try {
    for (const { id, name, slug } of categories) {
      insertCategory.run(id, name, slug);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`Seeded ${categories.length} ticket categories on ${dbPath}`);
} finally {
  db.close();
}
