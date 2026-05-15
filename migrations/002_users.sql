-- WO-21: Users table, role enum, SSO subject, and FK wiring on ticket + audit_entries.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,                                         -- NULL for SSO-only accounts
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'agent', 'user')),
  sso_subject TEXT UNIQUE,                                    -- Cognito sub claim; NULL for password users
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_sso_subject ON users (sso_subject) WHERE sso_subject IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Rebuild ticket to add FK on submitter_ref -> users(id)
-- (SQLite does not support ADD CONSTRAINT on existing tables)
-- ---------------------------------------------------------------------------

CREATE TABLE ticket_new (
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
  FOREIGN KEY (submitter_ref) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (status_id) REFERENCES ticket_status (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (priority_id) REFERENCES ticket_priority (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (category_id) REFERENCES ticket_category (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO ticket_new
  SELECT id, public_number, title, description, submitter_ref,
         status_id, priority_id, category_id, created_at, updated_at
  FROM ticket;

DROP TABLE ticket;
ALTER TABLE ticket_new RENAME TO ticket;

CREATE INDEX ix_ticket_queue ON ticket (status_id, priority_id, created_at DESC);
CREATE INDEX ix_ticket_category_created ON ticket (category_id, created_at DESC);
CREATE INDEX ix_ticket_submitter_created ON ticket (submitter_ref, created_at DESC);

-- ---------------------------------------------------------------------------
-- Rebuild audit_entries to add FK on actor_id -> users(id)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_entries_new (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  previous_values TEXT NOT NULL DEFAULT '{}',
  new_values TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO audit_entries_new
  SELECT id, entity_type, entity_id, action, actor_id,
         previous_values, new_values, occurred_at
  FROM audit_entries;

DROP TABLE audit_entries;
ALTER TABLE audit_entries_new RENAME TO audit_entries;

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
