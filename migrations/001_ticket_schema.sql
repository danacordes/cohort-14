-- WO-1: Ticket data model, reference data, sequence for public numbers, audit trail.
-- submitter_ref + audit_entries.actor_id: TEXT without FK until users table exists.

CREATE TABLE ticket_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE ticket_priority (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE ticket_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ticket_number_seq (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_seq INTEGER NOT NULL DEFAULT 0
);

INSERT INTO ticket_number_seq (id, next_seq) VALUES (1, 0);

CREATE TABLE ticket (
  id TEXT PRIMARY KEY,
  public_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  submitter_ref TEXT NOT NULL,
  status_id INTEGER NOT NULL,
  priority_id INTEGER NOT NULL,
  category_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (status_id) REFERENCES ticket_status (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (priority_id) REFERENCES ticket_priority (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (category_id) REFERENCES ticket_category (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX ix_ticket_queue ON ticket (status_id, priority_id, created_at DESC);
CREATE INDEX ix_ticket_category_created ON ticket (category_id, created_at DESC);
CREATE INDEX ix_ticket_submitter_created ON ticket (submitter_ref, created_at DESC);

CREATE TABLE audit_entries (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  previous_values TEXT NOT NULL DEFAULT '{}',
  new_values TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_audit_entity_time ON audit_entries (entity_type, entity_id, occurred_at DESC);

CREATE TRIGGER audit_entries_no_update
BEFORE UPDATE ON audit_entries
BEGIN
  SELECT RAISE(ABORT, 'audit_entries are immutable');
END;

CREATE TRIGGER audit_entries_no_delete
BEFORE DELETE ON audit_entries
BEGIN
  SELECT RAISE(ABORT, 'audit_entries are append-only');
END;

INSERT INTO ticket_status (code, label, sort_order) VALUES
  ('OPEN', 'Open', 1),
  ('IN_PROGRESS', 'In Progress', 2),
  ('PENDING_USER_RESPONSE', 'Pending User Response', 3),
  ('RESOLVED', 'Resolved', 4),
  ('CLOSED', 'Closed', 5);

INSERT INTO ticket_priority (code, label, sort_order) VALUES
  ('CRITICAL', 'Critical', 1),
  ('HIGH', 'High', 2),
  ('MEDIUM', 'Medium', 3),
  ('LOW', 'Low', 4);

-- Follow-up when users table lands: ALTER ticket to FK submitter_ref -> users(id)
-- (or recreate table for SQLite limitations) and audit_entries.actor_id -> users(id).
