import path from 'path';
import { openDatabase } from './openDatabase.js';

const MAX_READ_CONNECTIONS = 9;
const MAX_TOTAL_CONNECTIONS = 10; // 1 writer + MAX_READ_CONNECTIONS

let _writeDb = null;
const _readPool = [];
let _readIndex = 0;

function resolveDbPath() {
  const raw = process.env.DB_PATH ?? 'dev.db';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

/**
 * Returns the single designated write connection.
 * All mutations must go through this connection to prevent lock contention.
 */
export function getWriteDb() {
  if (!_writeDb) {
    _writeDb = openDatabase(resolveDbPath());
  }
  return _writeDb;
}

/**
 * Returns a read connection from the pool (round-robin, up to MAX_READ_CONNECTIONS).
 * Since node:sqlite is synchronous and Node.js is single-threaded, the pool
 * enforces the single-writer architectural contract and is ready for a multi-
 * threaded SQLCipher driver swap without call-site changes.
 */
export function getReadDb() {
  if (_readPool.length < MAX_READ_CONNECTIONS) {
    const conn = openDatabase(resolveDbPath());
    _readPool.push(conn);
    return conn;
  }
  const conn = _readPool[_readIndex % MAX_READ_CONNECTIONS];
  _readIndex = (_readIndex + 1) % MAX_READ_CONNECTIONS;
  return conn;
}

/**
 * Closes all open connections in the pool. Call on server shutdown.
 */
export function closeAll() {
  if (_writeDb) {
    try { _writeDb.close(); } catch { /* already closed */ }
    _writeDb = null;
  }
  for (const conn of _readPool) {
    try { conn.close(); } catch { /* already closed */ }
  }
  _readPool.length = 0;
  _readIndex = 0;
}

export const MAX_CONNECTIONS = MAX_TOTAL_CONNECTIONS;
