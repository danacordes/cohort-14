import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { runPendingMigrations } from '../../db/migrate-lib.js';
import {
  isoUtcDaysAgo,
  kbAdminMetrics,
  parseKbMetricsDays,
} from './kbMetricsService.js';

function utcDaysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function insertKbArticle(db, opts) {
  const {
    id,
    number,
    title,
    flaggedForReview,
    authorId,
    status,
  } = {
    authorId: 'u1',
    status: 'Published',
    flaggedForReview: 0,
    ...opts,
  };
  db.prepare(
    `INSERT INTO kb_article (
       id, number, title, body, article_type, category_id,
       tags_json, status, author_id, current_version, flagged_for_review
     )
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    number,
    title,
    'Sample body.',
    'FAQ',
    'cat1',
    '[]',
    status,
    authorId,
    1,
    flaggedForReview ? 1 : 0,
  );
}

describe('kbMetricsService helpers', () => {
  it('parseKbMetricsDays parses Nd and clamps', () => {
    assert.strictEqual(parseKbMetricsDays(null), 30);
    assert.strictEqual(parseKbMetricsDays(''), 30);
    assert.strictEqual(parseKbMetricsDays('nope'), 30);
    assert.strictEqual(parseKbMetricsDays('7d'), 7);
    assert.strictEqual(parseKbMetricsDays('366D'), 366);
    assert.strictEqual(parseKbMetricsDays('900d'), 366);
    assert.strictEqual(parseKbMetricsDays('0d'), 1);
    assert.strictEqual(parseKbMetricsDays('1d'), 1);
  });

  it('isoUtcDaysAgo returns older timestamps for larger deltas', () => {
    const t10 = Date.parse(isoUtcDaysAgo(10));
    const t40 = Date.parse(isoUtcDaysAgo(40));
    assert.ok(Number.isFinite(t10));
    assert.ok(Number.isFinite(t40));
    assert.ok(t40 < t10);
  });
});

describe('kbAdminMetrics', () => {
  it('counts deflections and views inside the cutoff window only', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(
      `INSERT INTO users (id, email, role, password_hash) VALUES ('u1','a@x','user',NULL),
       ('u2','b@x','user',NULL), ('u3','c@x','user',NULL), ('u4','d@x','user',NULL),
       ('u5','e@x','user',NULL)`,
    ).run();
    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES ('cat1','Gen','gen')`).run();

    insertKbArticle(db, { id: 'a1', number: 'KB-0001', title: 'Alpha' });
    insertKbArticle(db, { id: 'a2', number: 'KB-0002', title: 'Beta' });

    const recentOcc = utcDaysAgoIso(2);
    const staleOcc = utcDaysAgoIso(240);
    db.prepare(
      `INSERT INTO deflection_event (id,user_id,article_id,query_text,occurred_at) VALUES (?,?,?,?,?), (?,?,?,?,?)`,
    ).run(crypto.randomUUID(), 'u1', 'a1', 'q', recentOcc, crypto.randomUUID(), 'u2', 'a1', '', staleOcc);

    const recentView = utcDaysAgoIso(5);
    const staleView = utcDaysAgoIso(200);

    db.prepare(
      `INSERT INTO kb_article_view (id,article_id,user_id,viewed_at)
       VALUES (?,?,?,?), (?,?,?,?), (?,?,?,?)`,
    ).run(
      crypto.randomUUID(),
      'a1',
      'u1',
      recentView,
      crypto.randomUUID(),
      'a1',
      'u3',
      recentView,
      crypto.randomUUID(),
      'a2',
      'u2',
      recentView,
    );

    db.prepare(`INSERT INTO kb_article_view (id,article_id,user_id,viewed_at) VALUES (?,?,?,?)`).run(
      crypto.randomUUID(),
      'a2',
      'u5',
      staleView,
    );

    const m = kbAdminMetrics(db, { period: '30d' });

    assert.strictEqual(m.deflectionCount, 1);

    /** @type {any[]} */
    const top = /** @type {any} */ (m.topViewed);
    assert.strictEqual(top.length, 2);
    assert.strictEqual(top[0].article.id, 'a1');
    assert.strictEqual(top[0].viewCount, 2);
    assert.strictEqual(top[1].article.id, 'a2');
    assert.strictEqual(top[1].viewCount, 1);
  });

  it('feedbackTrends includes only articles with 2+ ratings and prefers negative nets', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO users (id, email, role, password_hash)
      VALUES ('u1','x1@','user',NULL), ('u2','x2@','user',NULL), ('u3','x3@','user',NULL)`).run();

    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES ('cat1','Gen','gen')`).run();
    insertKbArticle(db, { id: 'a1', number: 'KB-0001', title: 'Poor' });
    insertKbArticle(db, { id: 'a2', number: 'KB-0002', title: 'OK' });

    const t = utcDaysAgoIso(1);

    db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(crypto.randomUUID(), 'a1', 'u1', 'helpful', t);
    db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(
      crypto.randomUUID(),
      'a1',
      'u2',
      'not_helpful',
      t,
    );

    db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(
      crypto.randomUUID(),
      'a2',
      'u1',
      'not_helpful',
      t,
    );
    db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(
      crypto.randomUUID(),
      'a2',
      'u2',
      'not_helpful',
      t,
    );
    db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(
      crypto.randomUUID(),
      'a2',
      'u3',
      'not_helpful',
      t,
    );

    const m = kbAdminMetrics(db, { period: '14d' });
    /** @type {any[]} */
    const fb = /** @type {any} */ (m.feedbackTrends);

    assert.strictEqual(fb.length, 2);
    assert.strictEqual(fb[0].article.id, 'a2');
    assert.strictEqual(fb[0].helpfulCount, 0);
    assert.strictEqual(fb[0].notHelpfulCount, 3);
    assert.strictEqual(fb[0].netScore, -3);
    assert.strictEqual(fb[1].article.id, 'a1');
    assert.strictEqual(fb[1].helpfulCount, 1);
    assert.strictEqual(fb[1].notHelpfulCount, 1);
    assert.strictEqual(fb[1].netScore, 0);

    insertKbArticle(db, { id: 'aSkip', number: 'KB-0003', title: 'Solo rating' });

    db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(
      crypto.randomUUID(),
      'aSkip',
      'u1',
      'helpful',
      t,
    );

    const soloTrend = kbAdminMetrics(db, { period: '14d' }).feedbackTrends.some(
      (/** @type {any} */ x) => x.article.id === 'aSkip',
    );
    assert.strictEqual(soloTrend, false, 'solo feedback totals < min count for trends');
  });

  it('coverage gaps include flagged articles, stale-view-only published, toxicity (deduped)', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    runPendingMigrations(db);

    db.prepare(`INSERT INTO users (id, email, role, password_hash)
      VALUES ('u1','x1@','user',NULL), ('u2','x2@','user',NULL), ('u3','x3@','user',NULL),
             ('u4','x4@','user',NULL)`).run();
    db.prepare(`INSERT INTO kb_category (id, name, slug) VALUES ('cat1','Gen','gen')`).run();

    insertKbArticle(db, {
      id: 'gapFlag',
      number: 'KB-0001',
      title: 'Flagged gap',
      flaggedForReview: 1,
    });
    insertKbArticle(db, { id: 'gapNoView', number: 'KB-0002', title: 'No recent views' });

    insertKbArticle(db, { id: 'gapToxic', number: 'KB-0003', title: 'Toxic only' });

    insertKbArticle(db, {
      id: 'overlap',
      number: 'KB-0004',
      title: 'Overlaps',
      flaggedForReview: 1,
    });

    insertKbArticle(db, { id: 'clean', number: 'KB-0005', title: 'Clean' });

    const oldView = utcDaysAgoIso(90);

    db.prepare(`INSERT INTO kb_article_view VALUES (?,?,?,?)`).run(
      crypto.randomUUID(),
      'gapNoView',
      'u1',
      oldView,
    );

    const tRecent = utcDaysAgoIso(5);
    for (let i = 1; i <= 4; i += 1) {
      db.prepare(`INSERT INTO kb_article_feedback VALUES (?,?,?,?,?)`).run(
        crypto.randomUUID(),
        'gapToxic',
        `u${i}`,
        'not_helpful',
        tRecent,
      );
    }

    db.prepare(`INSERT INTO kb_article_view VALUES (?,?,?,?)`).run(
      crypto.randomUUID(),
      'clean',
      'u1',
      tRecent,
    );

    /** @type {any} */
    const m = kbAdminMetrics(db, { period: '30d' });
    /** @type {Array<{article: {id: string}; reason: string}>} */
    const gaps = /** @type {any} */ (m.coverageGaps);

    assert.ok(gaps.find((x) => x.article.id === 'gapFlag'));

    assert.ok(gaps.find((x) => x.article.id === 'gapNoView'));
    assert.ok(gaps.some((x) => x.article.id === 'gapToxic'));

    /** @type {typeof gaps} */
    const overlap = gaps.filter((x) => x.article.id === 'overlap');
    assert.strictEqual(
      overlap.length,
      1,
      'addGap skips duplicate ids; flagged reason wins before others',
    );
    assert.strictEqual(overlap[0].reason.includes('Flagged'), true);

    assert.ok(!gaps.find((x) => x.article.id === 'clean'));
  });
});
