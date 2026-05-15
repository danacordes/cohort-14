import 'dotenv/config';
import path from 'path';
import { openDatabase } from './openDatabase.js';
import { runPendingMigrations } from './migrate-lib.js';

const rawDb = process.env.DB_PATH ?? 'dev.db';
const dbPath = path.isAbsolute(rawDb) ? rawDb : path.resolve(process.cwd(), rawDb);

const db = openDatabase(dbPath);
try {
  runPendingMigrations(db);
  console.log(`Migrations applied successfully on ${dbPath}`);
} finally {
  db.close();
}
