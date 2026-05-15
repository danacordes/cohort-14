import { randomUUID } from 'crypto';
import { getReadDb, getWriteDb } from '../db/pool.js';
import { reserveNextTicketPublicNumber } from '../db/ticket-number.js';
import { audit } from '../services/auditContext.js';
import { assertTransitionAllowed, REOPEN_ELIGIBLE } from '../services/ticketStatus.js';
import {
  computeDueDates,
  recalculateDueDates,
  pauseSLA,
  resumeSLA,
  getSLAStatus,
} from '../services/slaService.js';
import {
  listCategories,
  listAllCategories,
  createCategory,
  renameCategory,
  deactivateCategory,
} from '../services/categoryService.js';
import { saveAttachments, getAttachments } from '../services/ticketAttachmentService.js';
import { recordDeflection } from '../services/deflectionService.js';
import { dispatch, Events } from '../services/notificationDispatcher.js';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../errors/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireAuth(user) {
  if (!user) throw new ForbiddenError('Authentication required');
}

function requireRole(user, ...roles) {
  requireAuth(user);
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(`Role '${user.role}' is not permitted to perform this action`);
  }
}

/** Fetch a ticket row by UUID and throw NotFoundError if missing. */
function getTicketOrThrow(db, id) {
  const ticket = db.prepare(
    `SELECT t.*,
            ts.code  AS status_code,
            tp.code  AS priority_code,
            tc.name  AS category_name,
            tc.slug  AS category_slug,
            tc.is_active AS category_is_active,
            tc.created_at AS category_created_at,
            tc.updated_at AS category_updated_at
     FROM ticket t
     JOIN ticket_status   ts ON ts.id = t.status_id
     JOIN ticket_priority tp ON tp.id = t.priority_id
     LEFT JOIN ticket_category tc ON tc.id = t.category_id
     WHERE t.id = ?`
  ).get(id);
  if (!ticket) throw new NotFoundError(`Ticket ${id} not found`);
  return ticket;
}

/** Map a raw DB row to the GraphQL Ticket shape. */
function mapTicket(row) {
  return {
    id: row.id,
    publicNumber: row.public_number,
    title: row.title,
    description: row.description,
    submitterRef: row.submitter_ref,
    status: row.status_code,
    priority: row.priority_code,
    category: row.category_id
      ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          isActive: row.category_is_active === 1,
          createdAt: row.category_created_at,
          updatedAt: row.category_updated_at,
        }
      : null,
    assignedTo: row.assigned_to ?? null,
    resolutionSummary: row.resolution_summary ?? null,
    slaResponseDueAt: row.sla_response_due_at ?? null,
    slaResolutionDueAt: row.sla_resolution_due_at ?? null,
    slaPausedAt: row.sla_paused_at ?? null,
    slaStatus: getSLAStatus({ ...row, _priorityCode: row.priority_code }),
    resolvedAt: row.resolved_at ?? null,
    autoCloseAt: row.auto_close_at ?? null,
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a raw category row to the GraphQL TicketCategory shape. */
function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a raw ticket_attachment row to the GraphQL TicketAttachment shape. */
function mapAttachment(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageKey: row.storage_key,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

/** Map a raw deflection_event row to the GraphQL DeflectionEvent shape. */
function mapDeflectionEvent(row) {
  return {
    id: row.id,
    userId: row.user_id,
    articleId: row.article_id,
    queryText: row.query_text,
    occurredAt: row.occurred_at,
  };
}

/** Map a raw audit_entries row to the GraphQL AuditEntry shape. */
function mapAuditEntry(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorId: row.actor_id,
    previousValues: row.previous_values,
    newValues: row.new_values,
    occurredAt: row.occurred_at,
  };
}

/** Look up a status_id by code. */
function statusIdByCode(db, code) {
  const row = db.prepare('SELECT id FROM ticket_status WHERE code = ?').get(code);
  if (!row) throw new ValidationError(`Unknown status code: ${code}`);
  return row.id;
}

/** Look up a priority_id by code. */
function priorityIdByCode(db, code) {
  const row = db.prepare('SELECT id FROM ticket_priority WHERE code = ?').get(code);
  if (!row) throw new ValidationError(`Unknown priority code: ${code}`);
  return row.id;
}

// ---------------------------------------------------------------------------
// Query resolvers
// ---------------------------------------------------------------------------

const Query = {
  _empty: () => null,

  ticket(_parent, { id }, { user }) {
    requireAuth(user);
    const db = getReadDb();
    const ticket = getTicketOrThrow(db, id);

    if (user.role === 'user' && ticket.submitter_ref !== user.id) {
      throw new ForbiddenError('You may only view your own tickets');
    }
    return mapTicket(ticket);
  },

  tickets(_parent, { filter = {}, sort = {}, page = 1, pageSize = 25 }, { user }) {
    requireAuth(user);
    const db = getReadDb();

    const conditions = [];
    const params = [];

    if (user.role === 'user') {
      conditions.push('t.submitter_ref = ?');
      params.push(user.id);
    } else if (filter.submitterRef) {
      conditions.push('t.submitter_ref = ?');
      params.push(filter.submitterRef);
    }

    if (filter.status) {
      conditions.push('ts.code = ?');
      params.push(filter.status);
    }
    if (filter.priority) {
      conditions.push('tp.code = ?');
      params.push(filter.priority);
    }
    if (filter.categoryId) {
      conditions.push('t.category_id = ?');
      params.push(filter.categoryId);
    }
    if (filter.assignedTo) {
      conditions.push('t.assigned_to = ?');
      params.push(filter.assignedTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortField = sort.field === 'priority' ? 'tp.sort_order'
      : sort.field === 'status' ? 'ts.sort_order'
      : 't.created_at';
    const sortDir = sort.direction === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * pageSize;

    const sql = `
      SELECT t.*,
             ts.code  AS status_code,
             tp.code  AS priority_code,
             tc.name  AS category_name,
             tc.slug  AS category_slug,
             tc.is_active AS category_is_active,
             tc.created_at AS category_created_at,
             tc.updated_at AS category_updated_at
      FROM ticket t
      JOIN ticket_status   ts ON ts.id = t.status_id
      JOIN ticket_priority tp ON tp.id = t.priority_id
      LEFT JOIN ticket_category tc ON tc.id = t.category_id
      ${where}
      ORDER BY ${sortField} ${sortDir}
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM ticket t
      JOIN ticket_status   ts ON ts.id = t.status_id
      JOIN ticket_priority tp ON tp.id = t.priority_id
      LEFT JOIN ticket_category tc ON tc.id = t.category_id
      ${where}
    `;

    const rows = db.prepare(sql).all(...params, pageSize, offset);
    const { total } = db.prepare(countSql).get(...params);

    return {
      edges: rows.map((r) => ({ node: mapTicket(r) })),
      totalCount: total,
      page,
      pageSize,
    };
  },

  ticketCategories(_parent, _args, { user }) {
    requireAuth(user);
    const db = getReadDb();
    const rows = user.role === 'admin' ? listAllCategories(db) : listCategories(db);
    return rows.map(mapCategory);
  },

  ticketAuditLog(_parent, { ticketId }, { user }) {
    requireRole(user, 'agent', 'admin');
    const db = getReadDb();
    const rows = db.prepare(
      `SELECT * FROM audit_entries
       WHERE entity_type = 'Ticket' AND entity_id = ?
       ORDER BY occurred_at ASC`
    ).all(ticketId);
    return rows.map(mapAuditEntry);
  },

  ticketAttachments(_parent, { ticketId }, { user }) {
    requireAuth(user);
    const db = getReadDb();
    if (user.role === 'user') {
      const ticket = db.prepare('SELECT submitter_ref FROM ticket WHERE id = ?').get(ticketId);
      if (!ticket || ticket.submitter_ref !== user.id) {
        throw new ForbiddenError('You may only view attachments on your own tickets');
      }
    }
    return getAttachments(db, ticketId).map(mapAttachment);
  },
};

// ---------------------------------------------------------------------------
// Mutation resolvers
// ---------------------------------------------------------------------------

const Mutation = {
  createTicket(_parent, { input }, { user }) {
    requireAuth(user);
    const { title, description = '', priority = 'MEDIUM', categoryId = null, attachments = [] } = input;

    if (!title || !title.trim()) throw new ValidationError('Title is required');
    if (categoryId) {
      const db = getReadDb();
      const cat = db.prepare('SELECT id FROM ticket_category WHERE id = ? AND is_active = 1').get(categoryId);
      if (!cat) throw new ValidationError(`Category ${categoryId} not found or inactive`);
    }

    const db = getWriteDb();
    const id = randomUUID();
    const statusId = statusIdByCode(db, 'OPEN');
    const priorityId = priorityIdByCode(db, priority);
    const { responseDue, resolutionDue } = computeDueDates(priority);

    db.exec('BEGIN IMMEDIATE');
    try {
      const publicNumber = reserveNextTicketPublicNumber(db);
      db.prepare(
        `INSERT INTO ticket
           (id, public_number, title, description, submitter_ref,
            status_id, priority_id, category_id,
            sla_response_due_at, sla_resolution_due_at,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(id, publicNumber, title.trim(), description, user.id,
            statusId, priorityId, categoryId,
            responseDue, resolutionDue);

      if (attachments.length > 0) {
        saveAttachments(db, id, user.id, attachments);
      }

      audit(db, {
        entityType: 'Ticket',
        entityId: id,
        action: 'created',
        actorId: user.id,
        previousValues: {},
        newValues: { title: title.trim(), priority, status: 'OPEN', categoryId },
      });

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const ticket = getTicketOrThrow(db, id);

    dispatch(Events.TICKET_CREATED, {
      ticketId: id,
      publicNumber: ticket.public_number,
      submitterId: user.id,
      title: ticket.title,
    });

    return mapTicket(ticket);
  },

  updateTicketStatus(_parent, { id, status, resolutionSummary }, { user }) {
    requireRole(user, 'agent', 'admin');
    const db = getWriteDb();
    const ticket = getTicketOrThrow(db, id);

    assertTransitionAllowed(ticket.status_code, status, user.role);

    if (status === 'RESOLVED') {
      const summary = resolutionSummary ?? ticket.resolution_summary;
      if (!summary || !summary.trim()) {
        throw new ValidationError('resolutionSummary is required when resolving a ticket');
      }
    }

    const newStatusId = statusIdByCode(db, status);
    const now = new Date();
    const updates = { status_id: newStatusId, updated_at: "datetime('now')" };

    if (status === 'RESOLVED') {
      updates.resolved_at = now.toISOString();
      updates.resolution_summary = resolutionSummary ?? ticket.resolution_summary;
      updates.auto_close_at = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (status === 'CLOSED') {
      updates.closed_at = now.toISOString();
    }

    db.prepare(
      `UPDATE ticket
       SET status_id = ?,
           resolution_summary = COALESCE(?, resolution_summary),
           resolved_at = COALESCE(?, resolved_at),
           auto_close_at = COALESCE(?, auto_close_at),
           closed_at = COALESCE(?, closed_at),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      newStatusId,
      status === 'RESOLVED' ? (resolutionSummary ?? ticket.resolution_summary) : null,
      status === 'RESOLVED' ? now.toISOString() : null,
      status === 'RESOLVED' ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
      status === 'CLOSED' ? now.toISOString() : null,
      id,
    );

    if (status === 'PENDING_USER_RESPONSE') pauseSLA(db, id, now);
    if (ticket.status_code === 'PENDING_USER_RESPONSE' && status !== 'PENDING_USER_RESPONSE') {
      resumeSLA(db, id, now);
    }

    audit(db, {
      entityType: 'Ticket',
      entityId: id,
      action: 'status_changed',
      actorId: user.id,
      previousValues: { status: ticket.status_code },
      newValues: { status },
    });

    return mapTicket(getTicketOrThrow(db, id));
  },

  updateTicketPriority(_parent, { id, priority }, { user }) {
    requireRole(user, 'agent', 'admin');
    const db = getWriteDb();
    const ticket = getTicketOrThrow(db, id);

    if (['RESOLVED', 'CLOSED'].includes(ticket.status_code)) {
      throw new ValidationError('Cannot change priority of a resolved or closed ticket');
    }

    const priorityId = priorityIdByCode(db, priority);
    const { responseDue, resolutionDue } = recalculateDueDates(
      priority,
      ticket.created_at,
      ticket.sla_paused_at,
    );

    db.prepare(
      `UPDATE ticket
       SET priority_id = ?,
           sla_response_due_at = ?,
           sla_resolution_due_at = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(priorityId, responseDue, resolutionDue, id);

    audit(db, {
      entityType: 'Ticket',
      entityId: id,
      action: 'priority_changed',
      actorId: user.id,
      previousValues: { priority: ticket.priority_code },
      newValues: { priority },
    });

    return mapTicket(getTicketOrThrow(db, id));
  },

  updateTicketCategory(_parent, { id, categoryId }, { user }) {
    requireRole(user, 'agent', 'admin');
    const db = getWriteDb();
    const ticket = getTicketOrThrow(db, id);

    if (categoryId) {
      const cat = db.prepare(
        'SELECT id FROM ticket_category WHERE id = ? AND is_active = 1'
      ).get(categoryId);
      if (!cat) throw new ValidationError(`Category ${categoryId} not found or inactive`);
    }

    db.prepare(
      `UPDATE ticket SET category_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(categoryId ?? null, id);

    audit(db, {
      entityType: 'Ticket',
      entityId: id,
      action: 'category_changed',
      actorId: user.id,
      previousValues: { categoryId: ticket.category_id },
      newValues: { categoryId: categoryId ?? null },
    });

    return mapTicket(getTicketOrThrow(db, id));
  },

  reopenTicket(_parent, { id }, { user }) {
    requireAuth(user);
    const db = getWriteDb();
    const ticket = getTicketOrThrow(db, id);

    if (!REOPEN_ELIGIBLE.has(ticket.status_code)) {
      throw new ValidationError(
        `Ticket cannot be reopened from status: ${ticket.status_code}`
      );
    }
    if (user.role === 'user' && ticket.submitter_ref !== user.id) {
      throw new ForbiddenError('You may only reopen your own tickets');
    }

    const openStatusId = statusIdByCode(db, 'OPEN');
    const { responseDue, resolutionDue } = computeDueDates(ticket.priority_code);

    db.prepare(
      `UPDATE ticket
       SET status_id = ?,
           resolved_at = NULL,
           auto_close_at = NULL,
           closed_at = NULL,
           sla_paused_at = NULL,
           sla_response_due_at = ?,
           sla_resolution_due_at = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(openStatusId, responseDue, resolutionDue, id);

    audit(db, {
      entityType: 'Ticket',
      entityId: id,
      action: 'reopened',
      actorId: user.id,
      previousValues: { status: ticket.status_code },
      newValues: { status: 'OPEN' },
    });

    return mapTicket(getTicketOrThrow(db, id));
  },

  // ── Category admin mutations ─────────────────────────────────────────────

  createTicketCategory(_parent, { input }, { user }) {
    requireRole(user, 'admin');
    const db = getWriteDb();
    return mapCategory(createCategory(db, input));
  },

  renameTicketCategory(_parent, { id, name }, { user }) {
    requireRole(user, 'admin');
    const db = getWriteDb();
    return mapCategory(renameCategory(db, id, name));
  },

  deactivateTicketCategory(_parent, { id }, { user }) {
    requireRole(user, 'admin');
    const db = getWriteDb();
    return mapCategory(deactivateCategory(db, id));
  },

  recordDeflection(_parent, { articleId, queryText = '' }, { user }) {
    requireAuth(user);
    const db = getWriteDb();
    const row = recordDeflection(db, { userId: user.id, articleId, queryText });
    return mapDeflectionEvent(row);
  },
};

// ---------------------------------------------------------------------------
// Field resolvers
// ---------------------------------------------------------------------------

const Ticket = {
  attachments(parent, _args, _ctx) {
    const db = getReadDb();
    return getAttachments(db, parent.id).map(mapAttachment);
  },
};

export const ticketResolvers = { Query, Mutation, Ticket };
