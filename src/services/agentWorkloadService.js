/**
 * AgentWorkloadService — computes per-agent open ticket counts for the admin workload view.
 * Counts are computed live on each request (no cache) so they always reflect current queue state.
 */

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'PENDING_USER_RESPONSE'];

/**
 * Return a workload summary for all agents that have at least one open ticket,
 * plus any agents with zero open tickets who are in the users table with role='agent'.
 *
 * @param {object} db  read connection
 * @returns {Array<{ agentId: string, agentName: string, openTicketCount: number }>}
 */
export function getWorkloadSummary(db) {
  const rows = db.prepare(
    `SELECT
       u.id              AS agentId,
       u.email           AS agentName,
       COUNT(t.id)       AS openTicketCount
     FROM users u
     LEFT JOIN ticket t
       ON t.assigned_to = u.id
       AND t.status_id IN (
         SELECT id FROM ticket_status WHERE code IN ('OPEN','IN_PROGRESS','PENDING_USER_RESPONSE')
       )
     WHERE u.role = 'agent'
     GROUP BY u.id, u.email
     ORDER BY openTicketCount DESC, u.email ASC`
  ).all();

  return rows.map((r) => ({
    agentId: r.agentId,
    agentName: r.agentName,
    openTicketCount: r.openTicketCount,
  }));
}
