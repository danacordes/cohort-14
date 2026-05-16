import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { summarizeTicketThread, buildTicketThreadDigest } from './summarizationService.js';

describe('SummarizationService', () => {
  it('buildTicketThreadDigest includes header, notes, comments with labels', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES ('agent-1','a@t','agent',NULL)`).run();

    db.prepare(`INSERT INTO ticket_category (id, name, slug) VALUES ('cg','General','g')`).run();
    const openId = db.prepare(`SELECT id FROM ticket_status WHERE code = 'OPEN'`).get().id;
    const medId = db.prepare(`SELECT id FROM ticket_priority WHERE code = 'MEDIUM'`).get().id;

    db.prepare(
      `INSERT INTO ticket (id, public_number, title, description, submitter_ref,
         status_id, priority_id, category_id)
       VALUES (?, 'TKT-test', ?, ?, ?, ?, ?, ?)`
    ).run('tid-1', 'Printer jam', '', 'agent-1', openId, medId, 'cg');

    db.prepare(
      `INSERT INTO ticket_comment (id, ticket_id, body, is_internal, author_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      'com-1',
      'tid-1',
      'Queue stuck at tray 3',
      0,
      'agent-1'
    );

    db.prepare(
      `INSERT INTO ticket_comment (id, ticket_id, body, is_internal, author_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run('com-2', 'tid-1', 'Suspect dirty pickup roller.', 1, 'agent-1');

    const digest = buildTicketThreadDigest(db, 'tid-1');
    assert.match(digest, /Printer jam/);
    assert.match(digest, /Queue stuck/i);
    assert.match(digest, /Internal note/);
    assert.match(digest, /Suspect dirty pickup roller/);
    assert.ok(digest.includes('a@t') || digest.includes('agent-1'));

    /** @type {import('./llmClient.js').LLMClient} */
    const stub = /** @type {any} */ ({
      async generate() {
        return {
          content: '• Printer issue at tray.\n• Internal tech suspects roller.\n• Awaiting onsite swap.',
        };
      },
    });

    const out = await summarizeTicketThread(stub, db, 'tid-1');
    assert.match(out, /roller/i);
  });
});
