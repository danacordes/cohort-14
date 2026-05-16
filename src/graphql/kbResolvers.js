import { parseKbTags } from '../services/kb/kbArticleFtsSync.js';
import { getReadDb, getWriteDb } from '../db/pool.js';
import { ForbiddenError, ValidationError } from '../errors/index.js';
import { kbSearchArticles } from '../services/kb/kbSearchService.js';
import { kbAdminMetrics } from '../services/kb/kbMetricsService.js';
import {
  archiveKbArticle,
  adminPublishKbArticle,
  createKbArticle,
  getKbFeedbackFlagThreshold,
  linkKbArticleToTicket,
  listKbArticlesForTicket,
  listKbVersionsForArticle,
  loadKbArticleRow,
  mapKbArticleGraphql,
  rejectKbArticle,
  restoreKbArticleVersion,
  retireKbArticle,
  setKbFeedbackFlagThreshold,
  submitKbArticleForReview,
  unlinkKbArticleFromTicket,
  updateKbArticle,
  upsertKbArticleFeedback,
} from '../services/kb/kbArticleMgmtService.js';

function requireAuth(user) {
  if (!user) throw new ForbiddenError('Authentication required');
}

function requireAdmin(user) {
  requireAuth(user);
  if (user.role !== 'admin') {
    throw new ForbiddenError(`Role '${user.role}' is not permitted to perform this action`);
  }
}

function requireAgentOrAdmin(user) {
  requireAuth(user);
  if (user.role !== 'agent' && user.role !== 'admin') {
    throw new ForbiddenError('Agent or administrator access required');
  }
}

/**
 * Published: any authenticated caller. Draft / Pending: agents/admins only.
 *
 * Throws when the caller is not permitted to see the article. For unpublished
 * articles only, callers who are authenticated but lack staff roles should
 * use `kbArticle` returning null rather than invoking this helper.
 */
function assertKbReadable(user, row) {
  requireAuth(user);
  if (row.status === 'Published') return;
  requireAgentOrAdmin(user);
}

function mapRating(graphqlRating) {
  if (graphqlRating === 'HELPFUL') return 'helpful';
  if (graphqlRating === 'NOT_HELPFUL') return 'not_helpful';
  throw new ValidationError(`Invalid rating: ${graphqlRating}`);
}

export const kbResolvers = {
  Query: {
    kbSearch(_parent, { query = '', filters = null, page = null }, { user }) {
      requireAuth(user);
      const db = getReadDb();
      return kbSearchArticles(db, {
        query,
        filters,
        page,
        role: user.role,
      });
    },

    kbAdminMetrics(_parent, { period }, { user }) {
      requireAdmin(user);
      const db = getReadDb();
      return kbAdminMetrics(db, { period });
    },

    kbArticle(_parent, { id }, { user }) {
      const db = getReadDb();
      const row = loadKbArticleRow(db, id);
      if (!row) return null;
      if (row.status !== 'Published') {
        if (!user || (user.role !== 'agent' && user.role !== 'admin')) return null;
      } else if (!user) {
        throw new ForbiddenError('Authentication required');
      }
      return mapKbArticleGraphql(db, row);
    },

    kbArticleVersions(_parent, { id }, { user }) {
      requireAgentOrAdmin(user);
      const db = getReadDb();
      const row = loadKbArticleRow(db, id);
      if (!row) return [];
      assertKbReadable(user, row);
      return listKbVersionsForArticle(db, id).map((/** @type {any} */ v) => ({
        id: v.id,
        articleId: v.article_id,
        versionNumber: v.version_number,
        title: v.title,
        body: v.body,
        tags: parseKbTags(v.tags_json ?? '[]'),
        editorId: v.editor_id,
        editorEmail: v.editor_email ?? null,
        createdAt: v.created_at,
      }));
    },
  },

  Mutation: {
    createKbArticle(_parent, { input }, { user }) {
      requireAgentOrAdmin(user);
      const db = getWriteDb();
      return mapKbArticleGraphql(db, createKbArticle(db, user, input));
    },

    updateKbArticle(_parent, { id, input }, { user }) {
      requireAgentOrAdmin(user);
      const db = getWriteDb();
      const row = updateKbArticle(db, user, id, input);
      return mapKbArticleGraphql(db, row);
    },

    submitKbArticleForReview(_parent, { id, reviewerId }, { user }) {
      requireAgentOrAdmin(user);
      const db = getWriteDb();
      const row = submitKbArticleForReview(db, user, id, reviewerId ?? null);
      return mapKbArticleGraphql(db, row);
    },

    rejectKbArticle(_parent, { id, comment }, { user }) {
      requireAdmin(user);
      const db = getWriteDb();
      const row = rejectKbArticle(db, user, id, comment);
      return mapKbArticleGraphql(db, row);
    },

    publishKbArticle(_parent, { id }, { user }) {
      requireAdmin(user);
      const db = getWriteDb();
      const row = adminPublishKbArticle(db, user, id);
      return mapKbArticleGraphql(db, row);
    },

    retireKbArticle(_parent, { id }, { user }) {
      requireAdmin(user);
      const db = getWriteDb();
      const row = retireKbArticle(db, user, id);
      return mapKbArticleGraphql(db, row);
    },

    archiveKbArticle(_parent, { id }, { user }) {
      requireAdmin(user);
      const db = getWriteDb();
      const row = archiveKbArticle(db, user, id);
      return mapKbArticleGraphql(db, row);
    },

    restoreKbArticleVersion(_parent, { id, versionNumber }, { user }) {
      requireAdmin(user);
      const db = getWriteDb();
      const row = restoreKbArticleVersion(db, user, id, versionNumber);
      return mapKbArticleGraphql(db, row);
    },

    kbArticleFeedback(_parent, { articleId, rating }, { user }) {
      requireAuth(user);
      const db = getWriteDb();
      const out = upsertKbArticleFeedback(db, user.id, articleId, mapRating(rating));
      return {
        helpfulCount: out.counts.helpful,
        notHelpfulCount: out.counts.notHelpful,
        flaggedForReview: out.flagged,
        feedbackFlagThreshold: getKbFeedbackFlagThreshold(db),
      };
    },

    linkKbArticleToTicket(_parent, { ticketId, articleId }, { user }) {
      requireAgentOrAdmin(user);
      const db = getWriteDb();
      linkKbArticleToTicket(db, user, ticketId, articleId);
      return true;
    },

    unlinkKbArticleFromTicket(_parent, { ticketId, articleId }, { user }) {
      requireAgentOrAdmin(user);
      const db = getWriteDb();
      unlinkKbArticleFromTicket(db, user, ticketId, articleId);
      return true;
    },

    setKbFeedbackFlagThreshold(_parent, { threshold }, { user }) {
      requireAdmin(user);
      const db = getWriteDb();
      return setKbFeedbackFlagThreshold(db, threshold, user.id);
    },
  },

  KBArticle: {
    attachments(parent) {
      const db = getReadDb();
      return db
        .prepare(
          `SELECT id, article_id AS article_id, filename, mime_type AS mime_type,
                  extracted_text AS extracted_text,
                  uploaded_by AS uploaded_by, uploaded_at AS uploaded_at
           FROM kb_article_attachment
           WHERE article_id = ?
           ORDER BY uploaded_at ASC`,
        )
        .all(parent.id)
        .map((/** @type {any} */ a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mime_type,
          extractedText: a.extracted_text ?? null,
          uploadedBy: a.uploaded_by,
          uploadedAt: a.uploaded_at,
        }));
    },
  },
};

export function mapTicketKbLinksForGraphql(db, ticketId) {
  return listKbArticlesForTicket(db, ticketId).map((/** @type {any} */ r) => ({
    articleId: r.id,
    number: r.number,
    title: r.title,
    status: r.status,
    linkedAt: r.linked_at,
  }));
}
