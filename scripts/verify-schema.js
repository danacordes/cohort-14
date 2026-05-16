import fs from 'fs';
import os from 'os';
import path from 'path';
import { openDatabase } from '../src/db/openDatabase.js';
import { runPendingMigrations } from '../src/db/migrate-lib.js';
import { reserveNextTicketPublicNumber } from '../src/db/ticket-number.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function rmIfExists(file) {
  await fs.promises.rm(file, { force: true });
}

(async () => {
  const tmp = path.join(os.tmpdir(), `cohort14-schema-verify-${process.pid}-${Date.now()}.db`);
  await rmIfExists(tmp);
  try {
    const db = openDatabase(tmp);
    try {
      runPendingMigrations(db);

      db.prepare(
        `INSERT INTO users (id, email, role, password_hash) VALUES ('user-subject-1', 'user@verify.local', 'user', NULL)`
      ).run();
      db.prepare(
        `INSERT INTO users (id, email, role, password_hash) VALUES ('actor-1', 'actor@verify.local', 'agent', NULL)`
      ).run();

      const statusCount = db.prepare('SELECT COUNT(*) AS n FROM ticket_status').get().n;
      const prioCount = db.prepare('SELECT COUNT(*) AS n FROM ticket_priority').get().n;
      assert(statusCount === 5, `expected 5 ticket_status rows, got ${statusCount}`);
      assert(prioCount === 4, `expected 4 ticket_priority rows, got ${prioCount}`);

      db.prepare(`INSERT INTO ticket_category (id, name, slug) VALUES ('c1','General','general')`).run();

      const openId = db.prepare(`SELECT id FROM ticket_status WHERE code = 'OPEN'`).get().id;
      const highId = db.prepare(`SELECT id FROM ticket_priority WHERE code = 'HIGH'`).get().id;

      const insertTicket = db.prepare(`
        INSERT INTO ticket (id, public_number, title, description, submitter_ref, status_id, priority_id, category_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.exec('BEGIN IMMEDIATE');
      let publicNumber;
      try {
        publicNumber = reserveNextTicketPublicNumber(db);
        insertTicket.run(
          '11111111-1111-1111-1111-111111111111',
          publicNumber,
          'verify',
          '',
          'user-subject-1',
          openId,
          highId,
          'c1'
        );
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      assert(publicNumber === 'TKT-0001', `expected first public number TKT-0001, got ${publicNumber}`);

      const auditId = '22222222-2222-2222-2222-222222222222';
      db.prepare(`
        INSERT INTO audit_entries (id, entity_type, entity_id, action, actor_id, previous_values, new_values)
        VALUES (?, 'Ticket', ?, 'updated', ?, '{"priority_id":4}', '{"priority_id":2}')
      `).run(auditId, '11111111-1111-1111-1111-111111111111', 'actor-1');

      let mutated = false;
      try {
        db.prepare(`UPDATE audit_entries SET action = ? WHERE id = ?`).run('x', auditId);
        mutated = true;
      } catch {
        /**/
      }
      assert(!mutated, 'audit_entries update should have failed');

      let deleted = false;
      try {
        db.prepare(`DELETE FROM audit_entries WHERE id = ?`).run(auditId);
        deleted = true;
      } catch {
        /**/
      }
      assert(!deleted, 'audit_entries delete should have failed');

      let removedPrio = false;
      try {
        db.prepare(`DELETE FROM ticket_priority WHERE code = 'HIGH'`).run();
        removedPrio = true;
      } catch {
        /**/
      }
      assert(!removedPrio, 'Deleting priority in use must fail FK check');

      console.log('verify-schema OK');
    } finally {
      db.close();
    }
  } finally {
    await rmIfExists(tmp).catch(() => {});
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
