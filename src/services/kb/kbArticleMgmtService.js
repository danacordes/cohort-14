/** WO-13 — KB article lifecycle, versions, linking, ratings (SQLite / sync). */

import { randomUUID } from 'crypto';
import { rebuildKbArticleFts, parseKbTags } from './kbArticleFtsSync.js';
import { dispatch, Events } from '../notificationDispatcher.js';
import { audit } from '../auditContext.js';
import { reserveNextKbArticleNumber } from '../../db/kb-number.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../errors/index.js';
import { SYSTEM_AI_USER_ID } from '../../constants/systemUsers.js';

const OPEN_TICKET_STATUS_CODES = /** @type {const} */ ([
  'OPEN',
  'IN_PROGRESS',
  'PENDING_USER_RESPONSE',
]);

const ARTICLE_TYPES = new Set([
  'Solution',
  'How-To Guide',
  'Known Error',
  'FAQ',
]);

const ALLOWED_STATUSES_AGENT_WRITE = new Set(['Draft', 'PendingReview']);

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function getKbFeedbackFlagThreshold(db) {
  const row = db.prepare(`SELECT feedback_not_helpful_flag_threshold AS t FROM kb_config WHERE id = 1`).get();
  return row == null ? 4 : Number(row.t ?? 4);
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} threshold
 * @param {string} actorId
 */
export function setKbFeedbackFlagThreshold(db, threshold, actorId) {
  const t = Number(threshold);
  if (!Number.isFinite(t) || t < 1 || t > 999) {
    throw new ValidationError('Threshold must be between 1 and 999');
  }
  db.prepare(
    `UPDATE kb_config SET feedback_not_helpful_flag_threshold = ?, updated_at = datetime('now')
     WHERE id = 1`,
  ).run(t);
  audit(db, {
    entityType: 'KBArticle',
    entityId: 'kb-config',
    action: 'kb_feedback_threshold_updated',
    actorId,
    previousValues: {},
    newValues: { feedbackNotHelpfulFlagThreshold: t },
  });
  return getKbFeedbackFlagThreshold(db);
}

function requireAgentOrAdmin(role) {
  if (role !== 'agent' && role !== 'admin') {
    throw new ForbiddenError('Agent or administrator access required');
  }
}

function requireAdmin(role) {
  if (role !== 'admin') {
    throw new ForbiddenError('Administrator access required');
  }
}

/** @returns {never} */
function assertActiveCategory(db, categoryId, label = 'categoryId') {
  const row = db
    .prepare(
      `SELECT 1 FROM kb_category WHERE id = ? AND is_active = 1`,
    )
    .get(categoryId);
  if (!row) throw new ValidationError(`${label} must reference an active category`);
}

/**
 * Full publish-time validation per REQ-KB-002.*
 * @param {{ title?: string | null; body?: string | null; categoryId?: string | null; articleType?: string | null }} f
 */
export function validateKbPublishPayload(f) {
  const errors = [];
  const title = (f.title ?? '').trim();
  const body = (f.body ?? '').trim();
  const categoryId = (f.categoryId ?? '').trim();
  const articleType = (f.articleType ?? '').trim();
  if (!title) errors.push('title is required');
  if (!body) errors.push('body is required');
  if (!categoryId) errors.push('categoryId is required');
  if (!articleType) errors.push('articleType is required');
  else if (!ARTICLE_TYPES.has(articleType)) errors.push(`articleType must be one of ${[...ARTICLE_TYPES].join(', ')}`);
  if (errors.length) throw new ValidationError(errors.join('; '));
  return { title, body, categoryId, articleType };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} id
 */
export function loadKbArticleRow(db, id) {
  return db
    .prepare(
      `SELECT a.*,
              c.name AS category_name,
              au.email AS author_email,
              rv.email AS reviewer_email
       FROM kb_article a
       INNER JOIN kb_category c ON c.id = a.category_id
       LEFT JOIN users au ON au.id = a.author_id
       LEFT JOIN users rv ON rv.id = a.reviewer_id
       WHERE a.id = ?`,
    )
    .get(id);
}

/** @returns {unknown[]} */
export function listKbArticlesForTicket(db, ticketId) {
  return db
    .prepare(
      `SELECT a.id AS id, a.number AS number, a.title AS title, a.status AS status,
              tk.linked_at AS linked_at
       FROM ticket_kb_article tk
       INNER JOIN kb_article a ON a.id = tk.article_id
       WHERE tk.ticket_id = ?
       ORDER BY tk.linked_at DESC`,
    )
    .all(ticketId);
}

/** @returns {unknown[]} */
export function listKbVersionsForArticle(db, articleId) {
  return db
    .prepare(
      `SELECT v.id AS id, v.article_id AS article_id, v.version_number AS version_number,
              v.title AS title, v.body AS body, v.tags_json AS tags_json,
              v.editor_id AS editor_id, v.created_at AS created_at,
              u.email AS editor_email
       FROM kb_version v
       LEFT JOIN users u ON u.id = v.editor_id
       WHERE v.article_id = ?
       ORDER BY v.version_number DESC`,
    )
    .all(articleId);
}

/**
 * @returns {{ helpful: number; notHelpful: number }}
 */
function feedbackCounts(db, articleId) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN rating='helpful' THEN 1 ELSE 0 END) AS h,
         SUM(CASE WHEN rating='not_helpful' THEN 1 ELSE 0 END) AS nh
       FROM kb_article_feedback
       WHERE article_id = ?`,
    )
    .get(articleId);
  return { helpful: Number(row?.h ?? 0), notHelpful: Number(row?.nh ?? 0) };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} articleId
 */
export function refreshKbFeedbackFlag(db, articleId) {
  const thr = getKbFeedbackFlagThreshold(db);
  const { notHelpful } = feedbackCounts(db, articleId);
  if (notHelpful >= thr) {
    db.prepare(`UPDATE kb_article SET flagged_for_review = 1, updated_at = datetime('now') WHERE id = ?`).run(
      articleId,
    );
  }
}

/**
 * Canonical KB article facet for outbound notifications (email / in-app later).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} articleId
 */
function kbArticleNotificationFacet(db, articleId) {
  const row = loadKbArticleRow(db, articleId);
  if (!row) return { articleId };
  return {
    articleId,
    articleNumber: row.number,
    title: row.title,
    articleType: row.article_type,
    categoryId: row.category_id,
    status: row.status,
    authorId: row.author_id,
    expiresAt: row.expires_at ?? null,
    reviewDueAt: row.review_due_at ?? null,
  };
}

/**
 * Notify open ticket assignees/requestors when KB article inactive.
 */
function notifyOpenTicketsForArticle(db, articleId, payload) {
  const placeholders = OPEN_TICKET_STATUS_CODES.map(() => '?').join(', ');
  /** @type {{ id: string; public_number: string }[]} */
  const tickets = db
    .prepare(
      `SELECT t.id AS id, t.public_number AS public_number
       FROM ticket_kb_article tk
       INNER JOIN ticket t ON t.id = tk.ticket_id
       INNER JOIN ticket_status ts ON ts.id = t.status_id
       WHERE tk.article_id = ? AND ts.code IN (${placeholders})`,
    )
    .all(articleId, ...OPEN_TICKET_STATUS_CODES);
  const facet = kbArticleNotificationFacet(db, articleId);
  for (const t of tickets) {
    dispatch(Events.KB_ARTICLE_TICKET_LINK_STALE, {
      ticketId: t.id,
      publicNumber: t.public_number,
      ...facet,
      ...payload,
    });
  }
}

/** @returns {never} */
function assertArticleType(at) {
  if (!ARTICLE_TYPES.has(at)) throw new ValidationError(`Invalid articleType: ${at}`);
}

/**
 * @typedef {{ filename: string; mimeType: string; storageKey: string; extractedText?: string | null }} KbAttachIn
 */

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} articleId
 * @param {KbAttachIn[]} attachments
 * @param {string} uploadedBy
 */
function insertKbAttachments(db, articleId, attachments, uploadedBy) {
  const ins = db.prepare(
    `INSERT INTO kb_article_attachment
      (id, article_id, filename, mime_type, size_bytes, storage_key, extracted_text, uploaded_by)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
  );
  for (const a of attachments ?? []) {
    const fn = (a.filename ?? '').trim();
    const mt = (a.mimeType ?? '').trim();
    const sk = (a.storageKey ?? '').trim();
    if (!fn || !mt || !sk) throw new ValidationError('Each attachment needs filename, mimeType, storageKey');
    const ext = (a.extractedText ?? '').slice(0, 500000);
    ins.run(randomUUID(), articleId, fn, mt, sk, ext || null, uploadedBy);
  }
}

/**
 * @param {unknown} raw
 */
function tagsJsonFromInput(raw) {
  if (!raw || (Array.isArray(raw) && raw.length === 0)) return '[]';
  const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  return JSON.stringify(arr);
}

/** Count existing versions for numbering. */
function maxKbVersion(db, articleId) {
  const row = db
    .prepare(`SELECT MAX(version_number) AS mx FROM kb_version WHERE article_id = ?`)
    .get(articleId);
  return Number(row?.mx ?? 0);
}

/** Insert immutable snapshot row (incrementing KB version numbering). */
function insertKbSnapshot(db, articleId, title, body, tagsJson, editorId) {
  const next = maxKbVersion(db, articleId) + 1;
  db.prepare(
    `INSERT INTO kb_version (id, article_id, version_number, title, body, tags_json, editor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), articleId, next, title, body, tagsJson, editorId);
  return next;
}

/**
 * @typedef {{ role: string; id: string }} UserCtx
 */

/**
 * Create draft article (agent/admin).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {UserCtx} user
 * @param {{ title?: string | null; body?: string | null; categoryId: string; articleType: string; tags?: unknown; expiresAt?: string | null; reviewDueAt?: string | null; attachments?: KbAttachIn[] }} input
 */
export function createKbArticle(db, user, input) {
  requireAgentOrAdmin(user.role);
  assertActiveCategory(db, input.categoryId);
  assertArticleType(input.articleType);
  const title = (input.title ?? '').trim() || '(Untitled)';
  const body = (input.body ?? '').trim();
  const tagsJson = tagsJsonFromInput(input.tags);

  db.exec('BEGIN IMMEDIATE');
  try {
    const num = reserveNextKbArticleNumber(db);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO kb_article (
         id, number, title, body, article_type, category_id, tags_json,
         status, author_id, reviewer_id, review_due_at, expires_at, current_version,
         flagged_for_review, last_review_comment
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?,
         'Draft', ?, NULL, ?, ?, 1,
         0, NULL
       )`,
    ).run(
      id,
      num,
      title,
      body,
      input.articleType,
      input.categoryId,
      tagsJson,
      user.id,
      input.reviewDueAt?.trim() || null,
      input.expiresAt?.trim() || null,
    );
    insertKbAttachments(db, id, input.attachments ?? [], user.id);
    audit(db, {
      entityType: 'KBArticle',
      entityId: id,
      action: 'kb_article_created',
      actorId: user.id,
      previousValues: {},
      newValues: { status: 'Draft', number: num },
    });
    rebuildKbArticleFts(db, id);
    db.exec('COMMIT');
    return loadKbArticleRow(db, id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Can user mutate this draft/pending article? Author or admin only. */
function assertCanMutateKbArticle(actorId, actorRole, row, allowAdminAlways = false) {
  if (allowAdminAlways && actorRole === 'admin') return;
  if (row.author_id === actorId) return;
  if (actorRole === 'admin') return;
  throw new ForbiddenError('You may only edit your own KB articles unless you are an administrator');
}

/**
 * Update draft — or admin/agent editing pending (before publish).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {UserCtx} user
 */
export function updateKbArticle(db, user, articleId, input) {
  requireAgentOrAdmin(user.role);
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  assertCanMutateKbArticle(user.id, user.role, row);
  if (row.status === 'Published') {
    return updatePublishedKbArticle(db, user, articleId, input);
  }
  if (!ALLOWED_STATUSES_AGENT_WRITE.has(row.status)) {
    throw new ValidationError(`Cannot edit article in ${row.status} via this mutation`);
  }
  assertActiveCategory(db, row.category_id);
  assertArticleType(row.article_type);

  const nextTitle =
    input.title !== undefined ? String(input.title).trim() || '(Untitled)' : row.title;
  const nextBody = input.body !== undefined ? String(input.body).trim() : row.body;
  const nextCat = input.categoryId !== undefined ? String(input.categoryId).trim() : row.category_id;
  const nextType = input.articleType !== undefined ? String(input.articleType).trim() : row.article_type;
  const tagsJson =
    input.tags !== undefined ? tagsJsonFromInput(input.tags) : row.tags_json;
  assertActiveCategory(db, nextCat);
  assertArticleType(nextType);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE kb_article SET title=?, body=?, article_type=?, category_id=?,
                           tags_json=?, review_due_at=?, expires_at=?,
                           updated_at=datetime('now')
       WHERE id=?`,
    ).run(
      nextTitle,
      nextBody,
      nextType,
      nextCat,
      tagsJson,
      input.reviewDueAt !== undefined
        ? (input.reviewDueAt ? String(input.reviewDueAt).trim() : null)
        : row.review_due_at ?? null,
      input.expiresAt !== undefined
        ? (input.expiresAt ? String(input.expiresAt).trim() : null)
        : row.expires_at ?? null,
      articleId,
    );
    if (input.attachments?.length) insertKbAttachments(db, articleId, input.attachments, user.id);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_updated',
      actorId: user.id,
      previousValues: { status: row.status },
      newValues: { title: nextTitle },
    });
    rebuildKbArticleFts(db, articleId);
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Editing a published article appends immutable version snapshot rows.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {UserCtx} user
 */
function updatePublishedKbArticle(db, user, articleId, input) {
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  requireAgentOrAdmin(user.role);

  assertCanMutateKbArticle(user.id, user.role, row, true);

  const nextTitle = input.title !== undefined ? String(input.title).trim() : row.title;
  const nextBody = input.body !== undefined ? String(input.body).trim() : row.body;
  const nextCat = input.categoryId !== undefined ? String(input.categoryId).trim() : row.category_id;
  const nextType = input.articleType !== undefined ? String(input.articleType).trim() : row.article_type;
  const tagsJson =
    input.tags !== undefined ? tagsJsonFromInput(input.tags) : row.tags_json;
  assertActiveCategory(db, nextCat);
  assertArticleType(nextType);
  validateKbPublishPayload({
    title: nextTitle,
    body: nextBody,
    categoryId: nextCat,
    articleType: nextType,
  });

  db.exec('BEGIN IMMEDIATE');
  try {
    const vn = insertKbSnapshot(db, articleId, nextTitle, nextBody, tagsJson, user.id);
    db.prepare(
      `UPDATE kb_article SET title=?, body=?, article_type=?, category_id=?,
                           tags_json=?, review_due_at=?, expires_at=?,
                           current_version=?, updated_at=datetime('now')
       WHERE id=?`,
    ).run(
      nextTitle,
      nextBody,
      nextType,
      nextCat,
      tagsJson,
      input.reviewDueAt !== undefined
        ? (input.reviewDueAt ? String(input.reviewDueAt).trim() : null)
        : row.review_due_at ?? null,
      input.expiresAt !== undefined
        ? (input.expiresAt ? String(input.expiresAt).trim() : null)
        : row.expires_at ?? null,
      vn,
      articleId,
    );
    if (input.attachments?.length) insertKbAttachments(db, articleId, input.attachments, user.id);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_published_revision',
      actorId: user.id,
      previousValues: { currentVersion: row.current_version },
      newValues: { currentVersion: vn },
    });
    rebuildKbArticleFts(db, articleId);
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Agent submits draft → pending review. */
export function submitKbArticleForReview(db, user, articleId, reviewerId) {
  requireAgentOrAdmin(user.role);
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  assertCanMutateKbArticle(user.id, user.role, row);
  if (row.status !== 'Draft') {
    throw new ValidationError('Only Draft articles may be submitted for review');
  }
  validateKbPublishPayload({
    title: row.title,
    body: row.body,
    categoryId: row.category_id,
    articleType: row.article_type,
  });
  let rid = reviewerId?.trim() || null;
  if (rid) {
    const u = db.prepare(`SELECT id FROM users WHERE id = ?`).get(rid);
    if (!u) throw new ValidationError('reviewerId not found');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE kb_article SET status='PendingReview', reviewer_id=?,
                             updated_at=datetime('now')
       WHERE id=?`,
    ).run(rid, articleId);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_submitted_for_review',
      actorId: user.id,
      previousValues: { status: 'Draft' },
      newValues: { status: 'PendingReview', reviewerId: rid },
    });
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Admin publishes from PendingReview or Draft. */
export function adminPublishKbArticle(db, adminUser, articleId) {
  requireAdmin(adminUser.role);
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  if (!(row.status === 'PendingReview' || row.status === 'Draft')) {
    throw new ValidationError(`Cannot publish article in ${row.status}`);
  }
  validateKbPublishPayload({
    title: row.title,
    body: row.body,
    categoryId: row.category_id,
    articleType: row.article_type,
  });

  db.exec('BEGIN IMMEDIATE');
  try {
    const vnFinal = insertKbSnapshot(db, articleId, row.title, row.body, row.tags_json, adminUser.id);
    db.prepare(
      `UPDATE kb_article SET status='Published',
                             current_version=?,
                             last_review_comment=NULL,
                             reviewer_id=NULL,
                             updated_at=datetime('now')
       WHERE id=?`,
    ).run(vnFinal, articleId);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_published',
      actorId: adminUser.id,
      previousValues: { status: row.status },
      newValues: { status: 'Published' },
    });
    rebuildKbArticleFts(db, articleId);
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Admin rejects → draft with reviewer comment recorded. */
export function rejectKbArticle(db, adminUser, articleId, comment) {
  requireAdmin(adminUser.role);
  const msg = String(comment ?? '').trim();
  if (!msg) throw new ValidationError('Reject comment is required');
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  if (row.status !== 'PendingReview') throw new ValidationError('Only PendingReview articles may be rejected');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE kb_article SET status='Draft', reviewer_id=NULL,
                             last_review_comment=?, updated_at=datetime('now')
       WHERE id=?`,
    ).run(msg, articleId);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_rejected',
      actorId: adminUser.id,
      previousValues: { status: 'PendingReview' },
      newValues: { status: 'Draft', lastReviewComment: msg },
    });
    dispatch(Events.KB_ARTICLE_REJECTED_FOR_AUTHOR, {
      ...kbArticleNotificationFacet(db, articleId),
      reviewerId: adminUser.id,
      authorId: row.author_id,
      comment: msg,
      previousStatus: 'PendingReview',
    });
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function retireKbArticle(db, adminUser, articleId) {
  requireAdmin(adminUser.role);
  return mutateInactiveStatus(db, adminUser.id, articleId, 'Retired', 'kb_article_retired');
}

export function archiveKbArticle(db, adminUser, articleId) {
  requireAdmin(adminUser.role);
  return mutateInactiveStatus(db, adminUser.id, articleId, 'Archived', 'kb_article_archived');
}

/** @returns {never} */
function mutateInactiveStatus(db, actorId, articleId, /** @type {'Retired' | 'Archived' | 'Expired'} */ status, auditAction) {
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  const okFrom = new Set(['Published', 'Draft', 'PendingReview']);
  if (!okFrom.has(row.status)) {
    throw new ValidationError(`Cannot set ${status} from ${row.status}`);
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `UPDATE kb_article SET status=?, reviewer_id=NULL, updated_at=datetime('now')
       WHERE id=?`,
    ).run(status, articleId);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: auditAction,
      actorId,
      previousValues: { status: row.status },
      newValues: { status },
    });
    rebuildKbArticleFts(db, articleId);
    notifyOpenTicketsForArticle(db, articleId, { reason: status });
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Admin restores a historical version as the new canonical tip (+ version row). */
export function restoreKbArticleVersion(db, adminUser, articleId, versionNumber) {
  requireAdmin(adminUser.role);
  const vn = Number(versionNumber);
  if (!Number.isFinite(vn) || vn < 1) throw new ValidationError('Invalid versionNumber');
  const vers = db
    .prepare(
      `SELECT * FROM kb_version WHERE article_id = ? AND version_number = ?`,
    )
    .get(articleId, vn);
  if (!vers) throw new NotFoundError(`Version ${vn} not found`);

  db.exec('BEGIN IMMEDIATE');
  try {
    const nextV = insertKbSnapshot(db, articleId, vers.title, vers.body, vers.tags_json, adminUser.id);
    db.prepare(
      `UPDATE kb_article SET title=?, body=?, tags_json=?, status='Published',
                             current_version=?, updated_at=datetime('now')
       WHERE id=?`,
    ).run(
      vers.title,
      vers.body,
      vers.tags_json,
      nextV,
      articleId,
    );
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_version_restored',
      actorId: adminUser.id,
      previousValues: {},
      newValues: { restoredFromVersion: vn, currentVersion: nextV },
    });
    rebuildKbArticleFts(db, articleId);
    db.exec('COMMIT');
    return loadKbArticleRow(db, articleId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Any authenticated user helpful / not helpful for Published only. */
export function upsertKbArticleFeedback(db, userId, articleId, ratingNormalized) {
  const row = loadKbArticleRow(db, articleId);
  if (!row) throw new NotFoundError(`KB article ${articleId} not found`);
  if (row.status !== 'Published') throw new ValidationError('Feedback is only recorded for Published articles');

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(
      `INSERT INTO kb_article_feedback (id, article_id, user_id, rating, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(article_id, user_id)
       DO UPDATE SET rating = excluded.rating,
                     created_at = datetime('now')`,
    ).run(randomUUID(), articleId, userId, ratingNormalized);
    refreshKbFeedbackFlag(db, articleId);
    audit(db, {
      entityType: 'KBArticle',
      entityId: articleId,
      action: 'kb_article_feedback_upserted',
      actorId: userId,
      previousValues: {},
      newValues: { rating: ratingNormalized },
    });
    db.exec('COMMIT');
    const counts = feedbackCounts(db, articleId);
    const threshold = getKbFeedbackFlagThreshold(db);
    return { counts, flagged: counts.notHelpful >= threshold };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function linkKbArticleToTicket(db, user, ticketId, articleId) {
  requireAgentOrAdmin(user.role);
  const tk = db.prepare(`SELECT id FROM ticket WHERE id = ?`).get(ticketId);
  if (!tk) throw new NotFoundError(`Ticket ${ticketId} not found`);
  const article = db.prepare(`SELECT id FROM kb_article WHERE id = ?`).get(articleId);
  if (!article) throw new NotFoundError(`KB article ${articleId} not found`);
  const dup = db
    .prepare(`SELECT 1 FROM ticket_kb_article WHERE ticket_id = ? AND article_id = ?`)
    .get(ticketId, articleId);
  if (dup) throw new ValidationError('Article is already linked to this ticket');

  db.prepare(
    `INSERT INTO ticket_kb_article (id, ticket_id, article_id, linked_by_user_id)
     VALUES (?, ?, ?, ?)`,
  ).run(randomUUID(), ticketId, articleId, user.id);
  audit(db, {
    entityType: 'Ticket',
    entityId: ticketId,
    action: 'kb_article_linked_to_ticket',
    actorId: user.id,
    previousValues: {},
    newValues: { articleId },
  });
}

export function unlinkKbArticleFromTicket(db, user, ticketId, articleId) {
  requireAgentOrAdmin(user.role);
  const info = db
    .prepare(`DELETE FROM ticket_kb_article WHERE ticket_id = ? AND article_id = ?`)
    .run(ticketId, articleId);
  if (!info.changes) throw new NotFoundError('KB link not found');
  audit(db, {
    entityType: 'Ticket',
    entityId: ticketId,
    action: 'kb_article_unlinked_from_ticket',
    actorId: user.id,
    previousValues: { articleId },
    newValues: {},
  });
}

/** Expiry/review cron — mutate rows in place. Caller supplies write DB. */
export function runKbScheduledTransitions(db, nowIso = new Date().toISOString()) {
  const expired = db
    .prepare(
      `SELECT id FROM kb_article
       WHERE status = 'Published'
         AND expires_at IS NOT NULL
         AND expires_at <> ''
         AND datetime(expires_at) <= datetime(?)`,
    )
    .all(nowIso);

  for (const r of expired) {
    try {
      mutateInactiveStatus(db, SYSTEM_AI_USER_ID, r.id, 'Expired', 'kb_article_expired');
    } catch (_e) {
      /* skip row */
    }
  }

  const reviewDue = db
    .prepare(
      `SELECT id, author_id FROM kb_article
       WHERE status = 'Published'
         AND review_due_at IS NOT NULL
         AND review_due_at <> ''
         AND datetime(review_due_at) <= datetime(?)
         AND flagged_for_review = 0`,
    )
    .all(nowIso);
  for (const r of reviewDue) {
    try {
      db.prepare(`UPDATE kb_article SET flagged_for_review = 1, updated_at = datetime('now')
                  WHERE id = ?`).run(r.id);
      dispatch(Events.KB_ARTICLE_REVIEW_DUE, {
        ...kbArticleNotificationFacet(db, r.id),
        authorId: r.author_id,
      });
      audit(db, {
        entityType: 'KBArticle',
        entityId: r.id,
        action: 'kb_article_review_due_flagged',
        actorId: SYSTEM_AI_USER_ID,
        previousValues: {},
        newValues: {},
      });
    } catch (_e) {
      /* skip */
    }
  }
}

/**
 * Resolver helper — expose article summary with rating counts.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function mapKbArticleGraphql(db, row) {
  const tags = parseKbTags(row.tags_json ?? '[]');
  const fb = feedbackCounts(db, row.id);
  const thr = getKbFeedbackFlagThreshold(db);
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    body: row.body,
    articleType: row.article_type,
    status: row.status,
    tags,
    expiresAt: row.expires_at ?? null,
    reviewDueAt: row.review_due_at ?? null,
    flaggedForReview: row.flagged_for_review === 1,
    lastReviewComment: row.last_review_comment ?? null,
    currentVersion: row.current_version ?? 1,
    category: { id: row.category_id, name: row.category_name },
    author: row.author_id
      ? { id: row.author_id, email: row.author_email ?? '' }
      : null,
    reviewer: row.reviewer_id
      ? { id: row.reviewer_id, email: row.reviewer_email ?? '' }
      : null,
    helpfulCount: fb.helpful,
    notHelpfulCount: fb.notHelpful,
    feedbackFlagThreshold: thr,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
