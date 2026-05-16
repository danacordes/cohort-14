import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import { reserveNextKbArticleNumber } from '../../db/kb-number.js';
import { rebuildKbArticleFts } from './kbArticleFtsSync.js';
import { kbSearchArticles, tokenizeKbQuery, buildFtsClause } from './kbSearchService.js';

describe('kbSearchService', () => {
  it('tokenize strips punctuation-only queries', () => {
    assert.deepEqual(tokenizeKbQuery('@@@'), []);
  });

  it('builds ANDed fts prefix clause', () => {
    assert.strictEqual(buildFtsClause(['dhcp', 'wifi']), '"dhcp"* AND "wifi"*');
  });

  it('ranks DHCP article first and supports empty PendingReview admin listing', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO users (id, email, role, password_hash) VALUES ('u1','w@t','user',NULL)`).run();
    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES ('cat1','Network','net')`).run();

    db.exec('BEGIN IMMEDIATE');
    const n1 = reserveNextKbArticleNumber(db);
    const n2 = reserveNextKbArticleNumber(db);
    db.exec('COMMIT');

    db.prepare(
      `INSERT INTO kb_article (id, number, title, body, article_type, category_id, tags_json, status, author_id, current_version)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      'a1',
      n1,
      'Printer noise',
      'Replace pickup roller after jam.',
      'Solution',
      'cat1',
      JSON.stringify(['printer']),
      'Published',
      'u1',
      1,
    );
    db.prepare(
      `INSERT INTO kb_article (id, number, title, body, article_type, category_id, tags_json, status, author_id, current_version)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      'a2',
      n2,
      'DHCP WiFi',
      'Release renew on Windows to fix address.',
      'FAQ',
      'cat1',
      JSON.stringify(['wifi', 'dhcp']),
      'Published',
      'u1',
      1,
    );

    db.exec('BEGIN IMMEDIATE');
    const n3 = reserveNextKbArticleNumber(db);
    db.exec('COMMIT');

    db.prepare(
      `INSERT INTO kb_article (id, number, title, body, article_type, category_id, tags_json, status, author_id, current_version)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      'a3',
      n3,
      'Review me',
      'Body',
      'FAQ',
      'cat1',
      '[]',
      'PendingReview',
      'u1',
      1,
    );

    rebuildKbArticleFts(db, 'a1');
    rebuildKbArticleFts(db, 'a2');
    rebuildKbArticleFts(db, 'a3');

    const rUser = kbSearchArticles(db, {
      query: 'dhcp wifi',
      filters: null,
      page: null,
      role: 'user',
    });
    assert.strictEqual(rUser.totalCount, 1);
    assert.strictEqual(rUser.items.length, 1);
    assert.strictEqual(/** @type {any} */ (rUser.items[0]).id, 'a2');

    const miss = kbSearchArticles(db, {
      query: 'zzzznonexistentterm',
      filters: null,
      page: null,
      role: 'user',
    });
    assert.strictEqual(miss.totalCount, 0);
    assert.ok(Array.isArray(miss.suggestions));

    const pend = kbSearchArticles(db, {
      query: '',
      filters: { status: 'PendingReview' },
      page: { page: 1, pageSize: 10 },
      role: 'admin',
    });
    assert.strictEqual(pend.totalCount, 1);
  });
});
