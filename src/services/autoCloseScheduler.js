import { getWriteDb } from '../db/pool.js';
import { audit } from './auditContext.js';
import { dispatch, Events } from './notificationDispatcher.js';
import { generateSurveyToken, isEnabled } from './csatService.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Find all RESOLVED tickets where auto_close_at has passed and transition
 * them to CLOSED. Dispatches TICKET_CLOSED notification and CSAT token
 * for each ticket closed.
 *
 * @param {object} [db]  optional write connection (defaults to pool write db)
 */
export function runAutoClose(db) {
  const writeDb = db ?? getWriteDb();
  const now = new Date().toISOString();

  const closedStatusId = writeDb.prepare(
    `SELECT id FROM ticket_status WHERE code = 'CLOSED'`
  ).get()?.id;

  if (!closedStatusId) return;

  const eligible = writeDb.prepare(
    `SELECT t.id, t.closure_number, t.public_number
     FROM ticket t
     JOIN ticket_status ts ON ts.id = t.status_id
     WHERE ts.code = 'RESOLVED'
       AND t.auto_close_at IS NOT NULL
       AND t.auto_close_at <= ?`
  ).all(now);

  for (const ticket of eligible) {
    try {
      const newClosureNumber = (ticket.closure_number ?? 0) + 1;

      writeDb.prepare(
        `UPDATE ticket
         SET status_id = ?,
             closed_at = datetime('now'),
             closure_number = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(closedStatusId, newClosureNumber, ticket.id);

      audit(writeDb, {
        entityType: 'Ticket',
        entityId: ticket.id,
        action: 'auto_closed',
        actorId: 'system',
        previousValues: { status: 'RESOLVED' },
        newValues: { status: 'CLOSED', closureNumber: newClosureNumber },
      });

      const csatEnabled = isEnabled(writeDb);
      const surveyToken = csatEnabled
        ? generateSurveyToken(ticket.id, newClosureNumber)
        : null;

      dispatch(Events.TICKET_CLOSED, {
        ticketId: ticket.id,
        publicNumber: ticket.public_number,
        closureNumber: newClosureNumber,
        autoClose: true,
        surveyToken,
      });
    } catch (err) {
      // Log but don't abort processing of other tickets
      console.error(`[AutoCloseScheduler] Failed to close ticket ${ticket.id}:`, err.message);
    }
  }
}

/**
 * Start the auto-close polling interval.
 * Runs immediately on start, then every POLL_INTERVAL_MS.
 *
 * @returns {{ stop: () => void }}
 */
export function start() {
  runAutoClose();
  const intervalId = setInterval(runAutoClose, POLL_INTERVAL_MS);
  return {
    stop() {
      clearInterval(intervalId);
    },
  };
}
