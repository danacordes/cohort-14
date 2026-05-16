import { getReadDb } from '../db/pool.js';
import { ForbiddenError } from '../errors/index.js';
import { kbSearchArticles } from '../services/kb/kbSearchService.js';
import { kbAdminMetrics } from '../services/kb/kbMetricsService.js';

function requireAuth(user) {
  if (!user) throw new ForbiddenError('Authentication required');
}

function requireAdmin(user) {
  requireAuth(user);
  if (user.role !== 'admin') {
    throw new ForbiddenError(`Role '${user.role}' is not permitted to perform this action`);
  }
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
  },
};
