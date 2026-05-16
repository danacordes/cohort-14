import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ValidationError } from '../../errors/index.js';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import {
  archiveKbArticle,
  adminPublishKbArticle,
  createKbArticle,
  linkKbArticleToTicket,
  listKbArticlesForTicket,
  listKbVersionsForArticle,
  loadKbArticleRow,
  runKbScheduledTransitions,
  submitKbArticleForReview,
  updateKbArticle,
  validateKbPublishPayload,
} from './kbArticleMgmtService.js';

/** @param {import('node:sqlite').DatabaseSync} db */
function maxKbVersion(db, articleId) {
  const rows = listKbVersionsForArticle(db, articleId);
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((/** @type {any} */ r) => Number(r.version_number)));
}

describe('kbArticleMgmtService', () => {
  it('validateKbPublishPayload enforces publish-time fields', () => {
    assert.throws(
      () => validateKbPublishPayload({ title: '', body: 'x', categoryId: 'c', articleType: 'FAQ' }),
      ValidationError,
    );
    const v = validateKbPublishPayload({
      title: ' T ',
      body: ' B ',
      categoryId: 'c1',
      articleType: 'FAQ',
    });
    assert.strictEqual(v.title, 'T');
    assert.strictEqual(v.body, 'B');
  });

  it('draft→review→publish, published edit increments version, ticket link listing', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES ('a1','agent@','agent',NULL)`).run();
    db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES ('ad','admin@','admin',NULL)`).run();
    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES ('kc','Cat','cat')`).run();

    const openSid = db.prepare(`SELECT id FROM ticket_status WHERE code='OPEN'`).get().id;
    const prio = db.prepare(`SELECT id FROM ticket_priority WHERE code='MEDIUM'`).get().id;
    db.prepare(
      `INSERT INTO ticket (id, public_number, title, description, submitter_ref,
        status_id, priority_id)
       VALUES ('t1','PUB-TEST-WO13','Tk','desc','a1',?,?)`,
    ).run(openSid, prio);

    const agent = { id: 'a1', role: 'agent' };
    const admin = { id: 'ad', role: 'admin' };

    /** @type {any} */
    const draft = createKbArticle(db, agent, {
      categoryId: 'kc',
      articleType: 'FAQ',
      title: 'Start',
      body: 'Draft body',
      tags: ['x'],
    });
    assert.strictEqual(draft.status, 'Draft');

    submitKbArticleForReview(db, agent, draft.id, null);
    assert.strictEqual(/** @type {any} */ (loadKbArticleRow(db, draft.id)).status, 'PendingReview');

    adminPublishKbArticle(db, admin, draft.id);
    assert.strictEqual(/** @type {any} */ (loadKbArticleRow(db, draft.id)).status, 'Published');
    assert.strictEqual(maxKbVersion(db, draft.id), 1);

    updateKbArticle(db, agent, draft.id, { body: 'Updated published body.', tags: ['x', 'y'] });
    assert.strictEqual(/** @type {any} */ (loadKbArticleRow(db, draft.id)).body, 'Updated published body.');
    assert.strictEqual(maxKbVersion(db, draft.id), 2);

    linkKbArticleToTicket(db, agent, 't1', draft.id);
    assert.strictEqual(listKbArticlesForTicket(db, 't1').length, 1);

    archiveKbArticle(db, admin, draft.id);
    assert.strictEqual(/** @type {any} */ (loadKbArticleRow(db, draft.id)).status, 'Archived');
  });

  it('runKbScheduledTransitions marks published articles past expires_at as Expired', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES ('a1','agent@','agent',NULL)`).run();
    db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES ('ad','admin@','admin',NULL)`).run();
    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES ('kc','Cat','cat')`).run();

    const agent = { id: 'a1', role: 'agent' };
    const admin = { id: 'ad', role: 'admin' };

    const art = createKbArticle(db, agent, {
      categoryId: 'kc',
      articleType: 'Solution',
      title: 'Expiring doc',
      body: 'Soon old',
      expiresAt: '2001-05-07T12:00:00.000Z',
    });
    adminPublishKbArticle(db, admin, art.id);

    runKbScheduledTransitions(db, new Date().toISOString());
    assert.strictEqual(/** @type {any} */ (loadKbArticleRow(db, art.id)).status, 'Expired');
  });
});
