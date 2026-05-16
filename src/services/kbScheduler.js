import { getWriteDb } from '../db/pool.js';
import { runKbScheduledTransitions } from './kb/kbArticleMgmtService.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * WO-13: expiry + scheduled review reminders (SQLite background tick).
 *
 * @param {import('node:sqlite').DatabaseSync} [db]
 */
export function runKbSchedulerTick(db = getWriteDb()) {
  runKbScheduledTransitions(db);
}

/** @returns {{ stop: () => void }} */
export function start() {
  runKbScheduledTransitions();
  const intervalId = setInterval(runKbScheduledTransitions, POLL_INTERVAL_MS);
  return {
    stop() {
      clearInterval(intervalId);
    },
  };
}
