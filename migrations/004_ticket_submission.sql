-- WO-3: File attachments and KB deflection event tracking.

CREATE TABLE ticket_attachment (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES ticket (id) ON DELETE CASCADE
);

CREATE INDEX ix_attachment_ticket ON ticket_attachment (ticket_id);

CREATE TABLE deflection_event (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  query_text TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_deflection_user ON deflection_event (user_id, occurred_at DESC);
