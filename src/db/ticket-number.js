/**
 * Allocate the next human-readable ticket id (TKT-0001, …) via ticket_number_seq.
 * Caller must wrap in `BEGIN IMMEDIATE` / COMMIT alongside INSERT INTO ticket.
 */
export function reserveNextTicketPublicNumber(db) {
  const row = db
    .prepare(
      `UPDATE ticket_number_seq
       SET next_seq = next_seq + 1
       WHERE id = 1
       RETURNING next_seq AS n`
    )
    .get();
  if (row == null || row.n == null) {
    throw new Error('ticket_number_seq row missing (id=1)');
  }
  const n = row.n;
  return `TKT-${String(n).padStart(4, '0')}`;
}
