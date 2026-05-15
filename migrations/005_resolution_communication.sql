-- WO-7: Comments, holiday list, CSAT responses, closure config, closure counter.

CREATE TABLE ticket_comment (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  body TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES ticket (id) ON DELETE CASCADE
);

CREATE INDEX ix_comment_ticket ON ticket_comment (ticket_id, created_at ASC);

CREATE TRIGGER ticket_comment_no_update
BEFORE UPDATE ON ticket_comment
BEGIN
  SELECT RAISE(ABORT, 'ticket_comment rows are immutable');
END;

CREATE TRIGGER ticket_comment_no_delete
BEFORE DELETE ON ticket_comment
BEGIN
  SELECT RAISE(ABORT, 'ticket_comment rows are append-only');
END;

CREATE TABLE holiday (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE csat_response (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  closure_number INTEGER NOT NULL DEFAULT 1,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES ticket (id),
  UNIQUE (ticket_id, closure_number)
);

CREATE TABLE closure_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  auto_close_business_days INTEGER NOT NULL DEFAULT 5,
  csat_enabled INTEGER NOT NULL DEFAULT 1 CHECK (csat_enabled IN (0, 1))
);

INSERT INTO closure_config (id, auto_close_business_days, csat_enabled) VALUES (1, 5, 1);

ALTER TABLE ticket ADD COLUMN closure_number INTEGER NOT NULL DEFAULT 0;
