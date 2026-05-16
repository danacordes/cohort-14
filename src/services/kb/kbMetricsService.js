/** WO-12 — KB analytics for admin dashboards (REQ-KB-009). */

export function parseKbMetricsDays(period) {
  const m = /^(\d+)d$/i.exec(String(period ?? '').trim());
  if (!m) return 30;
  return Math.min(366, Math.max(1, Number(m[1])));
}

export function isoUtcDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function loadKbArticleBrief(db, id) {
  const row = db
    .prepare(`SELECT id, number, title FROM kb_article WHERE id = ?`).get(id);
  if (!row) return null;
  return { id: row.id, number: row.number, title: row.title };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ period?: string }} args
 */
export function kbAdminMetrics(db, args) {
  const cutoff = isoUtcDaysAgo(parseKbMetricsDays(args.period));

  const dr = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM deflection_event
       WHERE datetime(occurred_at) >= datetime(?)`,
    )
    .get(cutoff);
  const deflectionCount = Number(/** @type {any} */ (dr).cnt ?? 0);

  /** @type {{ aid: string; ct: number }[]} */
  const topRaw = db
    .prepare(
      `SELECT v.article_id AS aid, COUNT(*) AS ct
       FROM kb_article_view v
       INNER JOIN kb_article a ON a.id = v.article_id
       WHERE datetime(v.viewed_at) >= datetime(?)
       GROUP BY v.article_id
       ORDER BY ct DESC
       LIMIT 35`,
    )
    .all(cutoff);

  const topViewed = [];
  for (const r of topRaw) {
    const article = loadKbArticleBrief(db, r.aid);
    if (!article) continue;
    topViewed.push({ article, viewCount: Number(r.ct ?? 0) });
  }

  /** @type {{ aid: string; hc: number; nc: number }[]} */
  const fbRaw = db
    .prepare(
      `SELECT article_id AS aid,
              SUM(CASE WHEN rating='helpful' THEN 1 ELSE 0 END) AS hc,
              SUM(CASE WHEN rating='not_helpful' THEN 1 ELSE 0 END) AS nc
       FROM kb_article_feedback
       WHERE datetime(created_at) >= datetime(?)
       GROUP BY article_id`,
    )
    .all(cutoff);

  const fbSorted = fbRaw
    .filter((x) => x.hc + x.nc >= 2)
    .sort((x, y) => y.nc - y.hc - (x.nc - x.hc));

  const feedbackTrends = [];
  for (const r of fbSorted.slice(0, 40)) {
    const article = loadKbArticleBrief(db, r.aid);
    if (!article) continue;
    const hc = Number(r.hc ?? 0);
    const nc = Number(r.nc ?? 0);
    feedbackTrends.push({
      article,
      helpfulCount: hc,
      notHelpfulCount: nc,
      netScore: hc - nc,
    });
  }

  const coverageGaps = [];
  const gapSeen = new Set();
  function addGap(id, reason) {
    if (gapSeen.has(id)) return;
    const article = loadKbArticleBrief(db, id);
    if (!article) return;
    gapSeen.add(id);
    coverageGaps.push({ article, reason });
  }

  /** @type {{ id: string }[]} */
  const flaggedRows = db
    .prepare(`SELECT id FROM kb_article WHERE flagged_for_review = 1 LIMIT 25`)
    .all();
  for (const row of flaggedRows) {
    addGap(row.id, 'Flagged for review (low helpfulness pattern)');
  }

  /** @type {{ id: string }[]} */
  const zeroViewRows = db
    .prepare(
      `SELECT a.id AS id FROM kb_article a
       WHERE a.status = 'Published'
         AND NOT EXISTS (
           SELECT 1 FROM kb_article_view v
           WHERE v.article_id = a.id AND datetime(v.viewed_at) >= datetime(?)
         )
       LIMIT 35`,
    )
    .all(cutoff);
  for (const row of zeroViewRows) {
    addGap(row.id, 'No views in the reporting window');
  }

  for (const r of fbRaw) {
    const nc = Number(r.nc ?? 0);
    const hc = Number(r.hc ?? 0);
    if (nc >= 4 && nc >= hc + 2) {
      addGap(r.aid, 'High not-helpful vs helpful ratio in period');
    }
  }

  return {
    topViewed,
    deflectionCount,
    feedbackTrends,
    coverageGaps,
  };
}
